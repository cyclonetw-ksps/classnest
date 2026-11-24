// 驗證 Google Identity Services 發的 ID token（RS256 JWT）。
// 只信任 Google 公開金鑰簽的、受眾是本站用戶端 ID、還沒過期、信箱已驗證的 token。
// 不需要用戶端密碼。

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const CLOCK_SKEW_S = 60;

export interface GoogleIdentity {
  email: string;
  name: string;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

let cache: { keys: Jwk[]; expires: number } | null = null;

async function jwks(forceRefresh: boolean): Promise<Jwk[]> {
  const now = Date.now();
  if (!forceRefresh && cache && cache.expires > now) return cache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  cache = { keys: body.keys ?? [], expires: now + Math.min(maxAge, 86400) * 1000 };
  return cache.keys;
}

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s: string): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
  return parsed as Record<string, unknown>;
}

// 回傳驗證過的身分；任何一項不符就回 null（不說明原因，避免給攻擊者線索）
export async function verifyGoogleIdToken(token: unknown, clientId: string | undefined): Promise<GoogleIdentity | null> {
  if (typeof token !== "string" || !clientId) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  let signature: Uint8Array<ArrayBuffer>;
  try {
    header = b64urlJson(h);
    payload = b64urlJson(p);
    signature = b64urlBytes(s);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  let jwk = (await jwks(false)).find((k) => k.kid === header.kid);
  // Google 會輪換金鑰：找不到時重新抓一次
  if (!jwk) jwk = (await jwks(true)).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return null;
  }
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.iss !== "string" || !ISSUERS.has(payload.iss)) return null;
  if (payload.aud !== clientId) return null;
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S < now) return null;
  if (typeof payload.iat === "number" && payload.iat - CLOCK_SKEW_S > now) return null;
  if (payload.email_verified !== true) return null;
  if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;

  const email = payload.email.trim().toLowerCase();
  const name = typeof payload.name === "string" ? payload.name.slice(0, 60) : email.split("@")[0];
  return { email, name };
}
