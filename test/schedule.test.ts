import { describe, expect, it } from "vitest";
import type { Group, Period, WeekView } from "../src/shared/types";
import { api, FIRST_TEACHER, login, ok, state } from "./helpers";

const W = "2026-11-23"; // 週一
const PREV = "2026-11-16";

// 同一個檔案的測試共用一個班級，每個測試先清掉節次（固定課表跟著清掉）
async function fresh() {
  const c = await login(FIRST_TEACHER);
  for (const p of (await state(c)).periods) await ok(api(c, "DELETE", `/api/periods/${p.id}`));
  return c;
}
const addPeriod = (c: string, label: string, start: string, end: string) => ok(api<Period>(c, "POST", "/api/periods", { label, start, end }));
const week = (c: string, w = W) => ok(api<WeekView>(c, "GET", `/api/week/${w}`));
const cell = (v: WeekView, weekday: number, periodId: string) => v.lessons.find((l) => l.weekday === weekday && l.periodId === periodId)!;

describe("節次時間", () => {
  it("可以新增、修改、刪除節次，依開始時刻排序", async () => {
    const c = await fresh();
    const second = await addPeriod(c, "第二節", "09:30", "10:10");
    const first = await addPeriod(c, "第一節", "08:40", "09:20");
    expect((await state(c)).periods.map((p) => p.label)).toEqual(["第一節", "第二節"]);
    await ok(api(c, "PATCH", `/api/periods/${second.id}`, { label: "第 2 節", end: "10:15" }));
    const p2 = (await state(c)).periods.find((p) => p.id === second.id)!;
    expect(p2).toMatchObject({ label: "第 2 節", start: "09:30", end: "10:15" });
    await ok(api(c, "DELETE", `/api/periods/${first.id}`));
    expect((await state(c)).periods.map((p) => p.id)).toEqual([second.id]);
  });

  it("結束要晚於開始、時刻格式要對、名稱不可空白", async () => {
    const c = await fresh();
    expect((await api(c, "POST", "/api/periods", { label: "倒過來", start: "10:00", end: "09:00" })).status).toBe(400);
    expect((await api(c, "POST", "/api/periods", { label: "一樣", start: "10:00", end: "10:00" })).status).toBe(400);
    expect((await api(c, "POST", "/api/periods", { label: "格式", start: "8:4", end: "09:00" })).status).toBe(400);
    expect((await api(c, "POST", "/api/periods", { label: " ", start: "08:00", end: "09:00" })).status).toBe(400);
  });

  it("節次不能重疊（修改時也檢查），相接可以", async () => {
    const c = await fresh();
    const a = await addPeriod(c, "A", "08:40", "09:20");
    await addPeriod(c, "B", "09:20", "10:00");
    expect((await api(c, "POST", "/api/periods", { label: "重疊", start: "09:00", end: "09:30" })).status).toBe(400);
    expect((await api(c, "PATCH", `/api/periods/${a.id}`, { end: "09:30" })).status).toBe(400);
  });
});

describe("固定週課表", () => {
  it("可以設定、修改、清掉一格；刪掉節次時那節的課表也清掉", async () => {
    const c = await fresh();
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "課表國語組" }));
    const p = await addPeriod(c, "第一節", "08:40", "09:20");
    await ok(api(c, "PUT", "/api/slots", { weekday: 1, periodId: p.id, groupId: g.id, subject: "國語", bring: "國語課本" }));
    await ok(api(c, "PUT", "/api/slots", { weekday: 3, periodId: p.id, groupId: null, subject: "導師時間" }));
    let slots = (await state(c)).slots;
    expect(slots).toEqual(
      expect.arrayContaining([
        { weekday: 1, periodId: p.id, groupId: g.id, subject: "國語", bring: "國語課本" },
        { weekday: 3, periodId: p.id, groupId: null, subject: "導師時間", bring: "" },
      ]),
    );
    await ok(api(c, "PUT", "/api/slots", { weekday: 3, periodId: p.id, subject: "" }));
    slots = (await state(c)).slots;
    expect(slots.filter((s) => s.periodId === p.id)).toHaveLength(1);
    await ok(api(c, "DELETE", `/api/periods/${p.id}`));
    expect((await state(c)).slots.filter((s) => s.periodId === p.id)).toHaveLength(0);
  });

  it("星期、節次、組別要存在，科目不可太長", async () => {
    const c = await fresh();
    const p = await addPeriod(c, "第一節", "08:40", "09:20");
    expect((await api(c, "PUT", "/api/slots", { weekday: 6, periodId: p.id, subject: "週六" })).status).toBe(400);
    expect((await api(c, "PUT", "/api/slots", { weekday: 1, periodId: "nope", subject: "x" })).status).toBe(404);
    expect((await api(c, "PUT", "/api/slots", { weekday: 1, periodId: p.id, groupId: "nope", subject: "x" })).status).toBe(400);
    expect((await api(c, "PUT", "/api/slots", { weekday: 1, periodId: p.id, subject: "字".repeat(21) })).status).toBe(400);
  });
});

describe("每週計畫", () => {
  it("一週有週一到週五 × 每一節，帶出固定課表", async () => {
    const c = await fresh();
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "每週數學組" }));
    const p1 = await addPeriod(c, "第一節", "08:40", "09:20");
    const p2 = await addPeriod(c, "第二節", "09:30", "10:10");
    await ok(api(c, "PUT", "/api/slots", { weekday: 2, periodId: p2.id, groupId: g.id, subject: "數學", bring: "數學習作" }));
    const v = await week(c);
    expect(v.weekStart).toBe(W);
    expect(v.days.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
    expect(v.periods.map((p) => p.id)).toEqual([p1.id, p2.id]);
    expect(v.lessons).toHaveLength(10);
    expect(cell(v, 2, p2.id)).toMatchObject({ date: "2026-11-24", groupId: g.id, subject: "數學", bring: "數學習作", changed: false, cancelled: false, content: "" });
    expect(cell(v, 1, p1.id)).toMatchObject({ groupId: null, subject: "", base: null });
  });

  it("週的日期要是週一", async () => {
    const c = await fresh();
    expect((await api(c, "GET", "/api/week/2026-11-24")).status).toBe(400);
    expect((await api(c, "GET", "/api/week/2026-02-30")).status).toBe(400);
    expect((await api(c, "PUT", "/api/lessons", { weekStart: "2026-11-25", weekday: 1, periodId: "x", content: "x" })).status).toBe(400);
  });

  it("可以填教學內容、作業、這週要帶的東西（取代預設）", async () => {
    const c = await fresh();
    const p = await addPeriod(c, "第一節", "08:40", "09:20");
    await ok(api(c, "PUT", "/api/slots", { weekday: 1, periodId: p.id, subject: "國語", bring: "國語課本" }));
    await ok(api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 1, periodId: p.id, content: "第五課 生字", homework: "習作 p.12", bring: "字典" }));
    const v = await week(c);
    expect(cell(v, 1, p.id)).toMatchObject({ content: "第五課 生字", homework: "習作 p.12", bring: "字典", ownBring: "字典" });
    await ok(api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 1, periodId: p.id, bring: "" }));
    expect(cell(await week(c), 1, p.id)).toMatchObject({ bring: "國語課本", ownBring: "", content: "第五課 生字" });
    expect((await api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 1, periodId: p.id, content: "字".repeat(501) })).status).toBe(400);
  });

  it("臨時換課只改那一週那一節，取消換課回到固定課表", async () => {
    const c = await fresh();
    const g1 = await ok(api<Group>(c, "POST", "/api/groups", { name: "換課甲組" }));
    const g2 = await ok(api<Group>(c, "POST", "/api/groups", { name: "換課乙組" }));
    const p = await addPeriod(c, "第一節", "08:40", "09:20");
    await ok(api(c, "PUT", "/api/slots", { weekday: 4, periodId: p.id, groupId: g1.id, subject: "國語" }));
    await ok(api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 4, periodId: p.id, change: { groupId: g2.id, subject: "數學" } }));
    expect(cell(await week(c), 4, p.id)).toMatchObject({ changed: true, groupId: g2.id, subject: "數學", base: { groupId: g1.id, subject: "國語" } });
    expect(cell(await week(c, PREV), 4, p.id)).toMatchObject({ changed: false, groupId: g1.id, subject: "國語" });
    await ok(api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 4, periodId: p.id, change: null }));
    expect(cell(await week(c), 4, p.id)).toMatchObject({ changed: false, groupId: g1.id, subject: "國語" });
    expect((await api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 4, periodId: p.id, change: { groupId: null, subject: "" } })).status).toBe(400);
  });

  it("停課只影響那一週那一節，可寫原因，恢復後清掉原因", async () => {
    const c = await fresh();
    const p = await addPeriod(c, "第一節", "08:40", "09:20");
    await ok(api(c, "PUT", "/api/slots", { weekday: 5, periodId: p.id, subject: "體育" }));
    await ok(api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 5, periodId: p.id, cancelled: true, note: "校外教學" }));
    expect(cell(await week(c), 5, p.id)).toMatchObject({ cancelled: true, note: "校外教學", subject: "體育" });
    expect(cell(await week(c, "2026-11-30"), 5, p.id)).toMatchObject({ cancelled: false, note: "" });
    await ok(api(c, "PUT", "/api/lessons", { weekStart: W, weekday: 5, periodId: p.id, cancelled: false }));
    expect(cell(await week(c), 5, p.id)).toMatchObject({ cancelled: false, note: "" });
  });

  it("複製上週只填空格，不覆蓋、不複製換課與停課", async () => {
    const c = await fresh();
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "複製組" }));
    const p = await addPeriod(c, "第一節", "08:40", "09:20");
    const put = (w: string, weekday: number, extra: Record<string, unknown>) => ok(api(c, "PUT", "/api/lessons", { weekStart: w, weekday, periodId: p.id, ...extra }));
    await put(PREV, 1, { content: "上週一", homework: "上週一作業", bring: "上週一要帶" });
    await put(PREV, 2, { content: "上週二", cancelled: true, change: { groupId: g.id, subject: "美勞" } });
    await put(PREV, 3, { content: "上週三" });
    await put(W, 3, { content: "這週三已經寫好" });
    const r = await ok(api<{ copied: number }>(c, "POST", `/api/week/${W}/copy-last`));
    expect(r.copied).toBe(2);
    const v = await week(c);
    expect(cell(v, 1, p.id)).toMatchObject({ content: "上週一", homework: "上週一作業", ownBring: "上週一要帶" });
    expect(cell(v, 2, p.id)).toMatchObject({ content: "上週二", cancelled: false, changed: false });
    expect(cell(v, 3, p.id).content).toBe("這週三已經寫好");
    expect((await ok(api<{ copied: number }>(c, "POST", `/api/week/${W}/copy-last`))).copied).toBe(0);
  });
});
