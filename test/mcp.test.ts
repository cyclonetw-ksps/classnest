import { describe, expect, it } from "vitest";
import type { AgentKey, Board, Group, Period, WeekView } from "../src/shared/types";
import { api, call, FIRST_TEACHER, login, mcp, ok, state, tool } from "./helpers";

async function newKey(c: string, name: string) {
  return ok(api<{ id: string; name: string; key: string }>(c, "POST", "/api/agent-keys", { name }));
}

describe("agent 金鑰", () => {
  it("老師可以產生有名稱的金鑰；金鑰只在產生時出現一次", async () => {
    const c = await login(FIRST_TEACHER);
    const k = await newKey(c, "Claude 筆電");
    expect(k.key.length).toBeGreaterThanOrEqual(40);
    const listed = (await state(c)).agentKeys.find((x: AgentKey) => x.id === k.id)!;
    expect(listed.name).toBe("Claude 筆電");
    expect(listed.active).toBe(true);
    expect(JSON.stringify(await state(c))).not.toContain(k.key);
  });

  it("金鑰名稱不可空白", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "POST", "/api/agent-keys", { name: " " })).status).toBe(400);
  });

  it("停用的金鑰立即無法使用", async () => {
    const c = await login(FIRST_TEACHER);
    const k = await newKey(c, "會被停用");
    expect((await mcp(k.key, "tools/list")).status).toBe(200);
    await ok(api(c, "PATCH", `/api/agent-keys/${k.id}`, { active: false }));
    expect((await mcp(k.key, "tools/list")).status).toBe(401);
    expect((await state(c)).agentKeys.find((x) => x.id === k.id)?.active).toBe(false);
  });
});

describe("MCP 入口", () => {
  it("沒有金鑰或金鑰錯誤時拒絕所有呼叫", async () => {
    expect((await mcp(null, "initialize", { protocolVersion: "2025-06-18" })).status).toBe(401);
    expect((await mcp("not-a-real-key", "tools/list")).status).toBe(401);
    expect((await mcp("not-a-real-key", "tools/call", { name: "list_boards" })).status).toBe(401);
  });

  it("initialize 與 tools/list 回 JSON，工具只有組別、面板、卡片與課表", async () => {
    const c = await login(FIRST_TEACHER);
    const k = await newKey(c, "列工具");
    const init = await mcp(k.key, "initialize", { protocolVersion: "2025-06-18" });
    expect(init.status).toBe(200);
    expect(init.body?.result.protocolVersion).toBe("2025-06-18");
    const names = (await mcp(k.key, "tools/list")).body!.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["create_board", "create_card", "delete_board", "delete_card", "get_timetable", "get_week", "list_boards", "list_groups", "set_week_plan", "update_board", "update_card"]);
  });

  it("agent 可以列出組別（只有名稱，沒有學生）", async () => {
    const c = await login(FIRST_TEACHER);
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "MCP 組" }));
    await ok(api(c, "POST", "/api/students", { displayName: "MCP 看不到的學生", groupIds: [g.id] }));
    const k = await newKey(c, "列組別");
    const r = await tool(k.key, "list_groups");
    expect(r.isError).toBe(false);
    expect(r.value.groups).toEqual(expect.arrayContaining([{ id: g.id, name: "MCP 組" }]));
    expect(r.text).not.toContain("MCP 看不到的學生");
  });

  it("agent 可以建立面板、建立卡片、列出面板，卡片記下是哪把金鑰建立的", async () => {
    const c = await login(FIRST_TEACHER);
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "agent 組" }));
    const k = await newKey(c, "備課助手");
    const b = await tool(k.key, "create_board", { title: "agent 面板", groupIds: [g.id], shared: true });
    expect(b.isError).toBe(false);
    const board = b.value as Board;
    const card = await tool(k.key, "create_card", { boardId: board.id, kind: "homework", title: "閱讀單", url: "https://example.com/r", dueDate: "2026-12-02" });
    expect(card.isError).toBe(false);
    const listed = await tool(k.key, "list_boards");
    const found = (listed.value.boards as Board[]).find((x) => x.id === board.id)!;
    expect(found.groupIds).toEqual([g.id]);
    expect(found.cards[0].title).toBe("閱讀單");
    expect(found.cards[0].createdBy).toBe("agent：備課助手");
    const teacherView = (await state(c)).boards.find((x) => x.id === board.id)!;
    expect(teacherView.cards[0].createdBy).toBe("agent：備課助手");
  });

  it("agent 可以修改與刪除卡片和面板", async () => {
    const c = await login(FIRST_TEACHER);
    const k = await newKey(c, "改刪");
    const board = (await tool(k.key, "create_board", { title: "暫時面板" })).value as Board;
    const card = (await tool(k.key, "create_card", { boardId: board.id, kind: "text", title: "暫時卡" })).value;
    expect((await tool(k.key, "update_card", { id: card.id, title: "改過的卡" })).isError).toBe(false);
    expect((await tool(k.key, "update_board", { id: board.id, title: "改過的面板", shared: true })).isError).toBe(false);
    let found = (await state(c)).boards.find((x) => x.id === board.id)!;
    expect(found.title).toBe("改過的面板");
    expect(found.shared).toBe(true);
    expect(found.cards[0].title).toBe("改過的卡");
    expect((await tool(k.key, "delete_card", { id: card.id })).isError).toBe(false);
    expect((await tool(k.key, "delete_board", { id: board.id })).isError).toBe(false);
    expect((await state(c)).boards.find((x) => x.id === board.id)).toBeUndefined();
  });

  it("工具參數錯誤時回 isError 與中文說明", async () => {
    const c = await login(FIRST_TEACHER);
    const k = await newKey(c, "錯誤參數");
    const r = await tool(k.key, "create_card", { boardId: "nope", kind: "text", title: "x" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/面板/);
  });

  it("金鑰不能用在學生、分數、獎勵、老師、設定相關功能", async () => {
    const c = await login(FIRST_TEACHER);
    const k = await newKey(c, "越權測試");
    for (const name of ["create_student", "list_students", "award_points", "create_reward", "invite_teacher", "update_settings", "get_state"]) {
      const r = await mcp(k.key, "tools/call", { name, arguments: {} });
      expect(r.body?.error ?? r.body?.result?.isError, name).toBeTruthy();
    }
    const bearer = { authorization: `Bearer ${k.key}` };
    expect((await call("/api/state", { headers: bearer })).status).toBe(401);
    expect((await call("/api/students", { method: "POST", headers: bearer, json: { displayName: "x" } })).status).toBe(401);
    expect((await call("/api/points", { method: "POST", headers: bearer, json: {} })).status).toBe(401);
    expect((await call("/api/settings", { method: "PUT", headers: bearer, json: { title: "x" } })).status).toBe(401);
    expect((await call("/api/agent-keys", { method: "POST", headers: bearer, json: { name: "x" } })).status).toBe(401);
  });

  it("MCP 只收 POST", async () => {
    const res = await call("/api/mcp", { method: "GET" });
    expect([401, 405]).toContain(res.status);
  });
});

describe("MCP 課表工具", () => {
  async function setup() {
    const c = await login(FIRST_TEACHER);
    for (const p of (await state(c)).periods) await ok(api(c, "DELETE", `/api/periods/${p.id}`));
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "MCP 課表組" }));
    const p1 = await ok(api<Period>(c, "POST", "/api/periods", { label: "第一節", start: "08:40", end: "09:20" }));
    const p2 = await ok(api<Period>(c, "POST", "/api/periods", { label: "第二節", start: "09:30", end: "10:10" }));
    await ok(api(c, "PUT", "/api/slots", { weekday: 1, periodId: p1.id, groupId: g.id, subject: "國語" }));
    const k = await newKey(c, "課表助手");
    return { c, g, p1, p2, k };
  }

  it("agent 可以讀節次與固定課表、讀某一週", async () => {
    const { g, p1, k } = await setup();
    const t = await tool(k.key, "get_timetable");
    expect(t.isError).toBe(false);
    expect(t.value.periods.map((p: Period) => p.label)).toEqual(["第一節", "第二節"]);
    expect(t.value.slots).toEqual(expect.arrayContaining([expect.objectContaining({ weekday: 1, periodId: p1.id, groupId: g.id, subject: "國語" })]));
    expect(t.value.groups).toEqual(expect.arrayContaining([{ id: g.id, name: "MCP 課表組" }]));
    const w = await tool(k.key, "get_week", { weekStart: "2026-11-23" });
    expect((w.value as WeekView).lessons).toHaveLength(10);
  });

  it("agent 一次寫入整週，記下是哪把金鑰寫的", async () => {
    const { c, p1, p2, k } = await setup();
    const r = await tool(k.key, "set_week_plan", {
      weekStart: "2026-11-23",
      lessons: [
        { weekday: 1, periodId: p1.id, content: "第六課", homework: "生字一行" },
        { weekday: 2, periodId: p2.id, content: "分數加法", bring: "量角器" },
      ],
    });
    expect(r.isError).toBe(false);
    expect(r.value.saved).toBe(2);
    const v = await ok(api<WeekView>(c, "GET", "/api/week/2026-11-23"));
    const l1 = v.lessons.find((l) => l.weekday === 1 && l.periodId === p1.id)!;
    expect(l1).toMatchObject({ content: "第六課", homework: "生字一行", updatedBy: "agent：課表助手" });
    expect(v.lessons.find((l) => l.weekday === 2 && l.periodId === p2.id)).toMatchObject({ content: "分數加法", bring: "量角器" });
  });

  it("其中一格有錯時整批都不寫入", async () => {
    const { c, p1, k } = await setup();
    const r = await tool(k.key, "set_week_plan", {
      weekStart: "2026-11-30",
      lessons: [
        { weekday: 1, periodId: p1.id, content: "應該不會寫入" },
        { weekday: 9, periodId: p1.id, content: "錯的星期" },
      ],
    });
    expect(r.isError).toBe(true);
    const v = await ok(api<WeekView>(c, "GET", "/api/week/2026-11-30"));
    expect(v.lessons.every((l) => l.content === "")).toBe(true);
  });

  it("agent 不能換課、停課、改節次或固定課表", async () => {
    const { p1, k } = await setup();
    for (const name of ["create_period", "update_period", "delete_period", "set_slot", "change_lesson", "cancel_lesson", "copy_last_week"]) {
      const r = await mcp(k.key, "tools/call", { name, arguments: {} });
      expect(r.body?.error ?? r.body?.result?.isError, name).toBeTruthy();
    }
    // set_week_plan 只收內容、作業、要帶的東西；夾帶換課或停課也不會生效
    await tool(k.key, "set_week_plan", { weekStart: "2026-12-07", lessons: [{ weekday: 1, periodId: p1.id, content: "x", cancelled: true, change: { groupId: null, subject: "偷換" } }] });
    const w = await tool(k.key, "get_week", { weekStart: "2026-12-07" });
    expect((w.value as WeekView).lessons.find((l) => l.weekday === 1 && l.periodId === p1.id)).toMatchObject({ cancelled: false, changed: false, subject: "國語" });
  });
});
