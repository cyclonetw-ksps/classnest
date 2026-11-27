import { describe, expect, it } from "vitest";
import { api, call, FIRST_TEACHER, googleToken, login, ok, state } from "./helpers";

async function loginStatus(credential: string) {
  const res = await call("/api/auth/google", { method: "POST", json: { credential } });
  return { status: res.status, cookie: res.headers.get("set-cookie"), body: (await res.json().catch(() => null)) as { error?: string } | null };
}

describe("老師登入", () => {
  it("未登入時所有老師端讀寫都被拒絕", async () => {
    expect((await call("/api/state")).status).toBe(401);
    expect((await call("/api/me")).status).toBe(401);
    expect((await call("/api/students", { method: "POST", json: { displayName: "小明" } })).status).toBe(401);
    expect((await call("/api/points", { method: "POST", json: { reasonId: "x", studentIds: ["y"] } })).status).toBe(401);
  });

  it("部署設定指定的第一位老師可以登入（信箱不分大小寫），拿到 HttpOnly 工作階段", async () => {
    const res = await call("/api/auth/google", { method: "POST", json: { credential: await googleToken("FIRST@school.test") } });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^cn_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const me = await ok(api<{ email: string }>(cookie.split(";")[0], "GET", "/api/me"));
    expect(me.email).toBe(FIRST_TEACHER);
  });

  it("不在老師名單內的 Google 帳號被拒絕，也拿不到 cookie", async () => {
    const r = await loginStatus(await googleToken("stranger@school.test"));
    expect(r.status).toBe(403);
    expect(r.cookie).toBeNull();
    expect(r.body?.error).toBe("這個 Google 帳號不在老師名單內，請已登入的老師邀請你");
  });

  it("拒絕受眾不符、過期、信箱未驗證、簽章被竄改或不是 RS256 的 token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const bad = [
      await googleToken(FIRST_TEACHER, { aud: "someone-else.apps.googleusercontent.com" }),
      await googleToken(FIRST_TEACHER, { exp: now - 600, iat: now - 4000 }),
      await googleToken(FIRST_TEACHER, { email_verified: false }),
      await googleToken(FIRST_TEACHER, { iss: "https://evil.example.com" }),
      await googleToken(FIRST_TEACHER, {}, { alg: "none" }),
      await googleToken(FIRST_TEACHER, {}, { kid: "unknown-kid" }),
    ];
    const good = await googleToken(FIRST_TEACHER);
    const [h, p, s] = good.split(".");
    const tamperedPayload = btoa(JSON.stringify({ ...JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))), email: "x@school.test" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    bad.push(`${h}.${tamperedPayload}.${s}`, "not-a-jwt", "");
    for (const credential of bad) {
      const r = await loginStatus(credential);
      expect(r.status, credential.slice(0, 40)).toBe(401);
      expect(r.cookie).toBeNull();
    }
  });

  it("登出後同一個 cookie 失效", async () => {
    const cookie = await login(FIRST_TEACHER);
    expect((await call("/api/me", { cookie })).status).toBe(200);
    expect((await call("/api/auth/logout", { method: "POST", cookie })).status).toBe(200);
    expect((await call("/api/me", { cookie })).status).toBe(401);
  });

  it("來自其他網站的寫入請求被擋下", async () => {
    const cookie = await login(FIRST_TEACHER);
    const res = await call("/api/students", {
      method: "POST",
      cookie,
      headers: { origin: "https://evil.example.com" },
      json: { displayName: "入侵者" },
    });
    expect(res.status).toBe(403);
  });

  it("沒有開發登入入口", async () => {
    expect((await call("/api/auth/dev", { method: "POST", json: { email: FIRST_TEACHER } })).status).toBe(404);
  });
});

describe("多位老師", () => {
  it("第一位老師邀請第二位老師，第二位登入後看到同一份名單", async () => {
    const first = await login(FIRST_TEACHER);
    await ok(api(first, "POST", "/api/teachers", { email: "Second@School.test" }));
    await ok(api(first, "POST", "/api/students", { displayName: "共用名單生", homeClass: "", homeroomTeacher: "", groupIds: [] }));
    const second = await login("second@school.test");
    const s = await state(second);
    expect(s.me.email).toBe("second@school.test");
    expect(s.students.some((x) => x.displayName === "共用名單生")).toBe(true);
    expect(s.teachers.map((t) => t.email)).toEqual(expect.arrayContaining([FIRST_TEACHER, "second@school.test"]));
  });

  it("邀請信箱格式錯誤會被拒絕", async () => {
    const first = await login(FIRST_TEACHER);
    expect((await api(first, "POST", "/api/teachers", { email: "not-an-email" })).status).toBe(400);
  });

  it("停用某位老師後，他的工作階段立即失效，也不能再登入", async () => {
    const first = await login(FIRST_TEACHER);
    await ok(api(first, "POST", "/api/teachers", { email: "third@school.test" }));
    const third = await login("third@school.test");
    await ok(api(first, "PATCH", "/api/teachers/third%40school.test", { active: false }));
    expect((await call("/api/me", { cookie: third })).status).toBe(401);
    expect((await loginStatus(await googleToken("third@school.test"))).status).toBe(403);
  });

  it("不能停用自己", async () => {
    const first = await login(FIRST_TEACHER);
    expect((await api(first, "PATCH", `/api/teachers/${encodeURIComponent(FIRST_TEACHER)}`, { active: false })).status).toBe(400);
  });
});
