import { describe, expect, it } from "vitest";
import type { Board, Group, PublicView, ShareInfo } from "../src/shared/types";
import { api, call, FIRST_TEACHER, login, ok, state } from "./helpers";

async function view(code: string, body: Record<string, unknown> = {}) {
  const res = await call(`/api/public/${code}`, { method: "POST", json: body });
  const text = await res.text();
  return { status: res.status, text, body: (text ? JSON.parse(text) : null) as PublicView & { error?: string; needPin?: boolean } };
}

async function setup() {
  const c = await login(FIRST_TEACHER);
  await ok(api(c, "PUT", "/api/share", { pin: null }));
  const g1 = await ok(api<Group>(c, "POST", "/api/groups", { name: "分享甲組" }));
  const g2 = await ok(api<Group>(c, "POST", "/api/groups", { name: "分享乙組" }));
  const whole = await ok(api<Board>(c, "POST", "/api/boards", { title: "全班公告", shared: true }));
  const onlyA = await ok(api<Board>(c, "POST", "/api/boards", { title: "甲組進度", shared: true, groupIds: [g1.id] }));
  const onlyB = await ok(api<Board>(c, "POST", "/api/boards", { title: "乙組進度", shared: true, groupIds: [g2.id] }));
  const secret = await ok(api<Board>(c, "POST", "/api/boards", { title: "老師私人備忘", shared: false }));
  await ok(api(c, "POST", "/api/cards", { boardId: whole.id, kind: "link", title: "學習單", url: "https://example.com/sheet" }));
  await ok(api(c, "POST", "/api/students", { displayName: "不該外流的名字", groupIds: [g1.id] }));
  const share = (await state(c)).share;
  return { c, g1, g2, whole, onlyA, onlyB, secret, share };
}

describe("分享頁", () => {
  it("班級有一個分享代碼，老師看得到", async () => {
    const c = await login(FIRST_TEACHER);
    const share: ShareInfo = (await state(c)).share;
    expect(share.code).toMatch(/^[A-Za-z0-9_-]{16,}$/);
  });

  it("分享連結只出現分享的面板，回應裡沒有學生名單、分數、獎勵或建立者", async () => {
    const { whole, onlyA, onlyB, secret, share } = await setup();
    const r = await view(share.code);
    expect(r.status).toBe(200);
    const ids = r.body.boards.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining([whole.id, onlyA.id, onlyB.id]));
    expect(ids).not.toContain(secret.id);
    expect(Object.keys(r.body).sort()).toEqual(["boards", "groups", "title"]);
    expect(r.text).not.toContain("不該外流的名字");
    expect(r.text).not.toContain("school.test");
    for (const k of ["students", "events", "rewards", "reasons", "teachers", "createdBy", "total"]) expect(r.text).not.toContain(`"${k}"`);
  });

  it("公開頁列出分享面板用到的組別名稱", async () => {
    const { g1, g2, share } = await setup();
    const names = (await view(share.code)).body.groups.map((g) => g.name);
    expect(names).toEqual(expect.arrayContaining([g1.name, g2.name]));
  });

  it("切到某組時，只出現標了該組的面板與全班面板", async () => {
    const { g1, whole, onlyA, onlyB, share } = await setup();
    const ids = (await view(share.code, { group: g1.id })).body.boards.map((b) => b.id);
    expect(ids).toContain(whole.id);
    expect(ids).toContain(onlyA.id);
    expect(ids).not.toContain(onlyB.id);
  });

  it("代碼錯誤時看不到任何內容", async () => {
    await setup();
    expect((await view("wrong-code-000000000")).status).toBe(404);
  });

  it("設了通關碼時，要輸入正確的 4 位數才看得到", async () => {
    const { c, share } = await setup();
    expect((await api(c, "PUT", "/api/share", { pin: "12a4" })).status).toBe(400);
    expect((await api(c, "PUT", "/api/share", { pin: "123" })).status).toBe(400);
    await ok(api(c, "PUT", "/api/share", { pin: "2468" }));
    expect((await state(c)).share.hasPin).toBe(true);
    const none = await view(share.code);
    expect(none.status).toBe(401);
    expect(none.body.needPin).toBe(true);
    expect(none.body.boards).toBeUndefined();
    expect((await view(share.code, { pin: "1111" })).status).toBe(401);
    expect((await view(share.code, { pin: "2468" })).status).toBe(200);
    await ok(api(c, "PUT", "/api/share", { pin: null }));
    expect((await view(share.code)).status).toBe(200);
  });

  it("通關碼連續答錯太多次會暫停，老師重設通關碼後恢復", async () => {
    const { c, share } = await setup();
    await ok(api(c, "PUT", "/api/share", { pin: "8642" }));
    for (let i = 0; i < 10; i++) expect((await view(share.code, { pin: "0000" })).status).toBe(401);
    expect((await view(share.code, { pin: "8642" })).status).toBe(429);
    await ok(api(c, "PUT", "/api/share", { pin: "8642" }));
    expect((await view(share.code, { pin: "8642" })).status).toBe(200);
    await ok(api(c, "PUT", "/api/share", { pin: null }));
  });

  it("重設分享代碼後，舊連結立即打不開，新連結可以", async () => {
    const { c, share } = await setup();
    const next = await ok(api<ShareInfo>(c, "POST", "/api/share/reset"));
    expect(next.code).not.toBe(share.code);
    expect((await view(share.code)).status).toBe(404);
    expect((await view(next.code)).status).toBe(200);
  });

  it("未登入不能改分享設定", async () => {
    expect((await call("/api/share/reset", { method: "POST" })).status).toBe(401);
    expect((await call("/api/share", { method: "PUT", json: { pin: null } })).status).toBe(401);
  });
});
