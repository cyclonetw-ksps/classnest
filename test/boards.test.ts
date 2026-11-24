import { describe, expect, it } from "vitest";
import type { Board, BoardCard, Group } from "../src/shared/types";
import { api, call, FIRST_TEACHER, login, ok, state } from "./helpers";

async function newBoard(c: string, title: string, extra: Record<string, unknown> = {}) {
  return ok(api<Board>(c, "POST", "/api/boards", { title, ...extra }));
}
async function newCard(c: string, boardId: string, card: Record<string, unknown>) {
  return ok(api<BoardCard>(c, "POST", "/api/cards", { boardId, ...card }));
}
const boardIn = async (c: string, id: string) => (await state(c)).boards.find((b) => b.id === id);

describe("公布欄面板", () => {
  it("可以新增、改名、刪除面板", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "本週進度");
    expect(b.shared).toBe(false);
    expect(b.groupIds).toEqual([]);
    await ok(api(c, "PATCH", `/api/boards/${b.id}`, { title: "下週進度" }));
    expect((await boardIn(c, b.id))?.title).toBe("下週進度");
    await ok(api(c, "DELETE", `/api/boards/${b.id}`));
    expect(await boardIn(c, b.id)).toBeUndefined();
  });

  it("面板名稱不可空白或太長", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "POST", "/api/boards", { title: " " })).status).toBe(400);
    expect((await api(c, "POST", "/api/boards", { title: "字".repeat(31) })).status).toBe(400);
  });

  it("可以調整面板順序", async () => {
    const c = await login(FIRST_TEACHER);
    const a = await newBoard(c, "順序A");
    const b = await newBoard(c, "順序B");
    const order = async () => (await state(c)).boards.map((x) => x.id).filter((id) => id === a.id || id === b.id);
    expect(await order()).toEqual([a.id, b.id]);
    const idxB = (await state(c)).boards.findIndex((x) => x.id === b.id);
    await ok(api(c, "PATCH", `/api/boards/${b.id}`, { position: idxB - 1 }));
    expect(await order()).toEqual([b.id, a.id]);
  });

  it("可以標一個以上的組別，不標代表全班；組別要存在", async () => {
    const c = await login(FIRST_TEACHER);
    const g1 = await ok(api<Group>(c, "POST", "/api/groups", { name: "面板組一" }));
    const g2 = await ok(api<Group>(c, "POST", "/api/groups", { name: "面板組二" }));
    const b = await newBoard(c, "分組面板", { groupIds: [g1.id, g2.id] });
    expect((await boardIn(c, b.id))?.groupIds.sort()).toEqual([g1.id, g2.id].sort());
    await ok(api(c, "PATCH", `/api/boards/${b.id}`, { groupIds: [] }));
    expect((await boardIn(c, b.id))?.groupIds).toEqual([]);
    expect((await api(c, "PATCH", `/api/boards/${b.id}`, { groupIds: ["nope"] })).status).toBe(400);
  });

  it("可以設成分享或私人", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "分享切換", { shared: true });
    expect((await boardIn(c, b.id))?.shared).toBe(true);
    await ok(api(c, "PATCH", `/api/boards/${b.id}`, { shared: false }));
    expect((await boardIn(c, b.id))?.shared).toBe(false);
  });

  it("未登入不能讀寫面板", async () => {
    expect((await call("/api/boards", { method: "POST", json: { title: "x" } })).status).toBe(401);
  });
});

describe("公布欄卡片", () => {
  it("可以新增文字卡、連結卡、作業卡，並記下建立者", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "卡片面板");
    await newCard(c, b.id, { kind: "text", title: "提醒", body: "明天帶色鉛筆" });
    await newCard(c, b.id, { kind: "link", title: "均一影片", url: "https://www.junyiacademy.org/" });
    await newCard(c, b.id, { kind: "homework", title: "數學習作", body: "p.12–13", url: "https://example.com/hw", dueDate: "2026-12-01" });
    const cards = (await boardIn(c, b.id))!.cards;
    expect(cards.map((x) => x.kind)).toEqual(["text", "link", "homework"]);
    expect(cards[2].dueDate).toBe("2026-12-01");
    expect(cards.every((x) => x.createdBy === "first@school.test")).toBe(true);
  });

  it("連結卡一定要有 http 或 https 網址；作業卡網址可以空白", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "網址檢查");
    expect((await api(c, "POST", "/api/cards", { boardId: b.id, kind: "link", title: "x" })).status).toBe(400);
    expect((await api(c, "POST", "/api/cards", { boardId: b.id, kind: "link", title: "x", url: "javascript:alert(1)" })).status).toBe(400);
    expect((await api(c, "POST", "/api/cards", { boardId: b.id, kind: "link", title: "x", url: "ftp://a.b/c" })).status).toBe(400);
    await newCard(c, b.id, { kind: "homework", title: "國語習作" });
    expect((await api(c, "POST", "/api/cards", { boardId: b.id, kind: "homework", title: "x", dueDate: "明天" })).status).toBe(400);
    expect((await api(c, "POST", "/api/cards", { boardId: b.id, kind: "poster", title: "x" })).status).toBe(400);
    expect((await api(c, "POST", "/api/cards", { boardId: "nope", kind: "text", title: "x" })).status).toBe(404);
  });

  it("文字卡不保留網址", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "文字卡網址");
    const k = await newCard(c, b.id, { kind: "text", title: "提醒", url: "https://example.com/" });
    expect(k.url).toBe("");
    const l = await newCard(c, b.id, { kind: "link", title: "連結", url: "https://example.com/" });
    const changed = await ok(api<BoardCard>(c, "PATCH", `/api/cards/${l.id}`, { kind: "text" }));
    expect(changed.url).toBe("");
  });

  it("文字卡至少要有標題或內文", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "空卡檢查");
    expect((await api(c, "POST", "/api/cards", { boardId: b.id, kind: "text", title: " ", body: "" })).status).toBe(400);
  });

  it("可以修改、刪除卡片，並調整卡片順序", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "卡片排序");
    const x = await newCard(c, b.id, { kind: "text", title: "第一張" });
    const y = await newCard(c, b.id, { kind: "text", title: "第二張" });
    await ok(api(c, "PATCH", `/api/cards/${x.id}`, { title: "第一張改", body: "補充" }));
    let cards = (await boardIn(c, b.id))!.cards;
    expect(cards[0].title).toBe("第一張改");
    expect(cards[0].body).toBe("補充");
    await ok(api(c, "PATCH", `/api/cards/${y.id}`, { position: 0 }));
    cards = (await boardIn(c, b.id))!.cards;
    expect(cards.map((k) => k.id)).toEqual([y.id, x.id]);
    await ok(api(c, "DELETE", `/api/cards/${x.id}`));
    cards = (await boardIn(c, b.id))!.cards;
    expect(cards.map((k) => k.id)).toEqual([y.id]);
  });

  it("刪除面板時，裡面的卡片一起刪掉", async () => {
    const c = await login(FIRST_TEACHER);
    const b = await newBoard(c, "連帶刪除");
    const k = await newCard(c, b.id, { kind: "text", title: "會被刪" });
    await ok(api(c, "DELETE", `/api/boards/${b.id}`));
    expect((await api(c, "PATCH", `/api/cards/${k.id}`, { title: "x" })).status).toBe(404);
  });
});
