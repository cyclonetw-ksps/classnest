// 伺服器端共用的輸入檢查與小工具。錯誤訊息直接給老師看，一律中文。

export type Result<T = unknown> = { ok: true; value: T } | { ok: false; status: number; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });

export class InputError extends Error {}

export type Body = Record<string, unknown>;

export function text(body: Body, key: string, max: number, opts: { required?: boolean; label: string }): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) {
    if (opts.required) throw new InputError(`請填寫${opts.label}`);
    return undefined;
  }
  if (typeof v !== "string") throw new InputError(`${opts.label}格式不正確`);
  const t = v.trim();
  if (opts.required && !t) throw new InputError(`請填寫${opts.label}`);
  if (t.length > max) throw new InputError(`${opts.label}最多 ${max} 個字`);
  return t;
}

export function int(body: Body, key: string, min: number, max: number, opts: { required?: boolean; label: string }): number | undefined {
  const v = body[key];
  if (v === undefined || v === null) {
    if (opts.required) throw new InputError(`請填寫${opts.label}`);
    return undefined;
  }
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new InputError(`${opts.label}要是 ${min} 到 ${max} 的整數`);
  }
  return v;
}

export function bool(body: Body, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new InputError("格式不正確");
  return v;
}

export function idList(body: Body, key: string, max: number): string[] | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== "string")) throw new InputError("名單格式不正確");
  return [...new Set(v as string[])];
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

