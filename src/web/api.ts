import type { ClassState, PublicConfig } from "../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? "連線出了問題，請稍後再試";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const getConfig = () => request<PublicConfig>("GET", "config");
export const getState = () => request<ClassState>("GET", "state");
export const loginWithGoogle = (credential: string) => request("POST", "auth/google", { credential });
export const logout = () => request("POST", "auth/logout");
