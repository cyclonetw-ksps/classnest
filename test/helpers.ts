import { env, exports } from "cloudflare:workers";
import type { ClassState } from "../src/shared/types";

const worker = (exports as unknown as { default: Fetcher }).default;
const testEnv = env as unknown as { GOOGLE_CLIENT_ID: string; TEST_GOOGLE_PRIVATE_JWK: string };

export const BASE = "https://classnest.test";
export const FIRST_TEACHER = "first@school.test";

export function call(path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return worker.fetch(new Request(BASE + path, { ...init, headers, body }));
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 用測試金鑰簽一張「Google ID token」；overrides 可以改任何 claim 或標頭
export async function googleToken(
  email: string,
  overrides: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
): Promise<string> {
  const jwk = JSON.parse(testEnv.TEST_GOOGLE_PRIVATE_JWK);
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "JWT", ...header }));
  const p = b64url(
    JSON.stringify({
      iss: "https://accounts.google.com",
      aud: testEnv.GOOGLE_CLIENT_ID,
      sub: `sub-${email}`,
      email,
      email_verified: true,
      name: email.split("@")[0],
      iat: now,
      exp: now + 3600,
      ...overrides,
    }),
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(sig)}`;
}

export async function login(email: string): Promise<string> {
  const res = await call("/api/auth/google", { method: "POST", json: { credential: await googleToken(email) } });
  if (res.status !== 200) throw new Error(`login failed ${res.status}: ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const pair = setCookie.split(";")[0];
  if (!pair.startsWith("cn_session=")) throw new Error(`no session cookie: ${setCookie}`);
  return pair;
}

export async function api<T = unknown>(cookie: string, method: string, path: string, json?: unknown): Promise<{ status: number; body: T }> {
  const res = await call(path, { method, cookie, json });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

export async function state(cookie: string): Promise<ClassState> {
  const { status, body } = await api<ClassState>(cookie, "GET", "/api/state");
  if (status !== 200) throw new Error(`state failed ${status}`);
  return body;
}

export async function ok<T>(p: Promise<{ status: number; body: T }>): Promise<T> {
  const r = await p;
  if (r.status !== 200) throw new Error(`expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body;
}

// 用 agent 金鑰呼叫 MCP 入口（JSON-RPC 2.0）
export async function mcp(key: string | null, method: string, params: Record<string, unknown> = {}, id: number | undefined = 1) {
  const headers: Record<string, string> = { accept: "application/json, text/event-stream" };
  if (key !== null) headers.authorization = `Bearer ${key}`;
  const res = await call("/api/mcp", { method: "POST", headers, json: { jsonrpc: "2.0", id, method, params } });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as { result?: any; error?: { code: number; message: string } } | null };
}

// 呼叫一個 MCP 工具；回傳解析後的內容或錯誤文字
export async function tool(key: string, name: string, args: Record<string, unknown> = {}) {
  const r = await mcp(key, "tools/call", { name, arguments: args });
  if (r.status !== 200 || !r.body?.result) throw new Error(`tool ${name} failed ${r.status}: ${JSON.stringify(r.body)}`);
  const text = r.body.result.content?.[0]?.text ?? "";
  if (r.body.result.isError) return { isError: true as const, text, value: null };
  return { isError: false as const, text, value: JSON.parse(text) };
}
