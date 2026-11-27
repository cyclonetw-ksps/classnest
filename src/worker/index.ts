import type { PublicConfig } from "../shared/types";
import type { Env } from "./env";
import { JwksUnavailableError, verifyGoogleIdToken } from "./google";
import { LONG_COOKIE_S } from "./kiosk";
import { handleMcp } from "./mcp";
export { ClassroomDO } from "./classroom";

const COOKIE = "cn_session";
// 學生平板與學生登入用另外兩個 cookie；老師 API 只認 cn_session
const DEVICE_COOKIE = "cn_device";
const STUDENT_COOKIE = "cn_student";
const COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
const MAX_BODY = 64 * 1024;

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });
const error = (status: number, message: string) => json({ error: message }, status);

function classroom(env: Env) {
  return env.CLASSROOM.get(env.CLASSROOM.idFromName("classroom"));
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

const sessionToken = (request: Request) => cookieValue(request, COOKIE);

function setCookie(name: string, token: string, maxAge: number): string {
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

const sessionCookie = (token: string, maxAge: number) => setCookie(COOKIE, token, maxAge);

const jsonResponse = (result: { status: number; json: string }, headers: [string, string][] = []) => {
  const h = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  for (const [k, v] of headers) h.append(k, v);
  return new Response(result.json, { status: result.status, headers: h });
};

// 寫入請求若帶了 Origin，必須是本站；擋掉其他網站借用老師的 cookie 送出的請求
function crossSite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const raw = await request.text();
  if (raw.length > MAX_BODY) return null;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function handleApi(request: Request, env: Env, path: string[]): Promise<Response> {
  if (crossSite(request)) return error(403, "不接受來自其他網站的請求");
  const room = classroom(env);

  // agent 入口：只認 agent 金鑰，不認老師的登入 cookie
  if (path.length === 1 && path[0] === "mcp") {
    return handleMcp(request, {
      auth: async (key) => (await room.agentAuth(key)) !== null,
      tool: (key, name, args) => room.agentTool(key, name, args),
    });
  }

  const body = await readBody(request);
  if (body === null) return error(400, "請求格式不正確");
  const route = `${request.method} ${path.join("/")}`;

  if (route === "GET config") {
    const config: PublicConfig = { title: await room.publicTitle(), googleClientId: env.GOOGLE_CLIENT_ID ?? "" };
    return json(config);
  }
  if (route === "POST auth/google") {
    let identity;
    try {
      identity = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID);
    } catch (e) {
      if (e instanceof JwksUnavailableError) return error(503, "暫時連不到 Google 驗證登入，請稍後再試");
      throw e;
    }
    if (!identity) return error(401, "Google 登入驗證失敗，請重新登入");
    const token = await room.login(identity.email, identity.name, env.FIRST_TEACHER_EMAIL);
    if (!token) return error(403, "這個 Google 帳號不在老師名單內，請已登入的老師邀請你");
    return json({ email: identity.email }, 200, { "set-cookie": sessionCookie(token, COOKIE_MAX_AGE_S) });
  }
  if (route === "POST auth/logout") {
    await room.logout(sessionToken(request));
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }

  // 分享頁：只憑分享代碼（與可選通關碼），只回分享的面板
  if (path[0] === "public") {
    if (request.method !== "POST" || path.length !== 2) return error(404, "找不到這個功能");
    const result = await room.publicView(path[1], body);
    return new Response(result.json, {
      status: result.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }

  // 學生平板：只認學生平板與學生的 cookie，不認老師的登入
  if (path[0] === "student") {
    const deviceToken = cookieValue(request, DEVICE_COOKIE);
    const result = await room.student(deviceToken, cookieValue(request, STUDENT_COOKIE), request.method, path.slice(1), body);
    const headers: [string, string][] = [];
    if (result.login) headers.push(["set-cookie", setCookie(STUDENT_COOKIE, result.login.token, result.login.maxAge)]);
    if (result.clear) headers.push(["set-cookie", setCookie(STUDENT_COOKIE, "", 0)]);
    // 學生平板每次讀名單就延長記住的時間
    if (route === "GET student/roster" && result.status === 200) headers.push(["set-cookie", setCookie(DEVICE_COOKIE, deviceToken, LONG_COOKIE_S)]);
    return jsonResponse(result, headers);
  }

  // 登入相關只有上面兩個入口，沒有其他（例如開發用的免驗證登入）
  if (path[0] === "auth") return error(404, "找不到這個功能");

  const me = await room.authenticate(sessionToken(request));
  if (!me) return error(401, "請先登入");
  if (route === "GET me") return json(me);

  // 把這台設成學生平板：發學生平板憑證，並登出這台的老師
  if (route === "POST devices") {
    const result = await room.enrollDevice(me, sessionToken(request), body);
    if (!result.token) return jsonResponse(result);
    return jsonResponse(result, [
      ["set-cookie", setCookie(DEVICE_COOKIE, result.token, LONG_COOKIE_S)],
      ["set-cookie", setCookie(STUDENT_COOKIE, "", 0)],
      ["set-cookie", sessionCookie("", 0)],
    ]);
  }

  return jsonResponse(await room.api(me, request.method, path, body));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const path = url.pathname.slice("/api/".length).split("/").filter(Boolean);
      return handleApi(request, env, path);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
