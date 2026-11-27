import { describe, expect, it } from "vitest";
import type { DiaryDay, DiaryEntry, Group, Period, Student } from "../src/shared/types";
import { api, call, FIRST_TEACHER, login, ok, state } from "./helpers";

const DAY = "2026-12-02"; // 週三
const MON = "2026-11-30";

// 同一個檔案的測試共用一個班級；組別與節次只建一次
let ready: Promise<{ c: string; g1: Group; g2: Group; p: Period[]; s1: Student; s2: Student; other: Student }> | null = null;
function setup() {
  ready ??= (async () => {
    const c = await login(FIRST_TEACHER);
    const g1 = await ok(api<Group>(c, "POST", "/api/groups", { name: "國語 A 組" }));
    const g2 = await ok(api<Group>(c, "POST", "/api/groups", { name: "數學 B 組" }));
    const p = [
      await ok(api<Period>(c, "POST", "/api/periods", { label: "第一節", start: "08:40", end: "09:20" })),
      await ok(api<Period>(c, "POST", "/api/periods", { label: "第二節", start: "09:30", end: "10:10" })),
      await ok(api<Period>(c, "POST", "/api/periods", { label: "第三節", start: "10:30", end: "11:10" })),
    ];
    const s1 = await ok(api<Student>(c, "POST", "/api/students", { displayName: "小明", groupIds: [g1.id] }));
    const s2 = await ok(api<Student>(c, "POST", "/api/students", { displayName: "小華", groupIds: [g1.id, g2.id] }));
    const other = await ok(api<Student>(c, "POST", "/api/students", { displayName: "別組的", groupIds: [g2.id] }));
    // 週三：第一節國語 A 組、第二節數學 B 組（這週換成國語 A 組上數學）、第三節國語 A 組（這週停課）
    await ok(api(c, "PUT", "/api/slots", { weekday: 3, periodId: p[0].id, groupId: g1.id, subject: "國語", bring: "國語課本" }));
    await ok(api(c, "PUT", "/api/slots", { weekday: 3, periodId: p[1].id, groupId: g2.id, subject: "數學", bring: "量角器" }));
    await ok(api(c, "PUT", "/api/slots", { weekday: 3, periodId: p[2].id, groupId: g1.id, subject: "國語", bring: "" }));
    await ok(api(c, "PUT", "/api/lessons", { weekStart: MON, weekday: 3, periodId: p[0].id, homework: "習作 p.32" }));
    await ok(api(c, "PUT", "/api/lessons", { weekStart: MON, weekday: 3, periodId: p[1].id, homework: "課本 p.18", bring: "鉛筆盒", change: { groupId: g1.id, subject: "數學" } }));
    await ok(api(c, "PUT", "/api/lessons", { weekStart: MON, weekday: 3, periodId: p[2].id, homework: "停課的作業", cancelled: true }));
    return { c, g1, g2, p, s1, s2, other };
  })();
  return ready;
}

const day = (c: string, date = DAY) => ok(api<DiaryDay>(c, "GET", `/api/diary/${date}`));
const entryOf = (d: DiaryDay, groupId: string) => d.entries.find((e) => e.groupId === groupId)!;
const save = (c: string, body: Record<string, unknown>) => api<DiaryEntry>(c, "PUT", "/api/diary", body);

describe("聯絡簿", () => {
  it("未登入不能讀寫", async () => {
    expect((await call(`/api/diary/${DAY}`)).status).toBe(401);
    expect((await call("/api/diary", { method: "PUT", json: { date: DAY } })).status).toBe(401);
  });

  it("每個使用中的組各一則；還沒寫時帶入當天課表這一組的作業與要帶的東西（換課照換過的、停課不算）", async () => {
    const { c, g1, g2 } = await setup();
    const d = await day(c, "2026-12-02");
    expect(d.date).toBe(DAY);
    const a = entryOf(d, g1.id);
    expect(a).toMatchObject({ status: "empty", homework: "", bring: "", note: "", studentNotes: [], sentAt: null });
    expect(a.suggested).toEqual({ homework: "國語：習作 p.32\n數學：課本 p.18", bring: "國語課本、鉛筆盒" });
    expect(entryOf(d, g2.id).suggested).toEqual({ homework: "", bring: "" });
  });

  it("週末與沒有課的日子，建議是空的", async () => {
    const { c, g1 } = await setup();
    expect(entryOf(await day(c, "2026-12-05"), g1.id).suggested).toEqual({ homework: "", bring: "" });
  });

  it("可以存成草稿、再發送；記下誰寫的與發送時間", async () => {
    const { c, g1 } = await setup();
    const date = "2026-12-03";
    const draft = await ok(save(c, { date, groupId: g1.id, homework: "習作 p.33", bring: "國語課本", note: "", status: "draft" }));
    expect(draft).toMatchObject({ status: "draft", homework: "習作 p.33", sentAt: null, updatedBy: FIRST_TEACHER });
    const sent = await ok(save(c, { date, groupId: g1.id, homework: "習作 p.33", bring: "國語課本", note: "請簽名", status: "sent" }));
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeGreaterThan(0);
    expect(entryOf(await day(c, date), g1.id)).toMatchObject({ status: "sent", note: "請簽名" });
    // 收回成草稿
    expect((await ok(save(c, { date, groupId: g1.id, homework: "習作 p.33", bring: "國語課本", note: "請簽名", status: "draft" }))).status).toBe("draft");
  });

  it("空的聯絡簿不能發送；全部清空就回到還沒寫", async () => {
    const { c, g2 } = await setup();
    const date = "2026-12-04";
    expect((await save(c, { date, groupId: g2.id, homework: " ", bring: "", note: "", status: "sent" })).status).toBe(400);
    await ok(save(c, { date, groupId: g2.id, homework: "寫一頁", status: "draft" }));
    const cleared = await ok(save(c, { date, groupId: g2.id, homework: "", bring: "", note: "", status: "draft" }));
    expect(cleared.status).toBe("empty");
    expect(entryOf(await day(c, date), g2.id).status).toBe("empty");
  });

  it("可以對組裡的學生加註；清空就刪掉；不在這一組或不存在的學生不行", async () => {
    const { c, g1, s1, s2, other } = await setup();
    const date = "2026-12-07";
    const e = await ok(
      save(c, {
        date,
        groupId: g1.id,
        homework: "習作",
        status: "draft",
        studentNotes: [
          { studentId: s1.id, text: "今天很專心" },
          { studentId: s2.id, text: "  " },
        ],
      }),
    );
    expect(e.studentNotes).toEqual([{ studentId: s1.id, text: "今天很專心" }]);
    const again = await ok(save(c, { date, groupId: g1.id, homework: "習作", status: "draft", studentNotes: [{ studentId: s1.id, text: "" }] }));
    expect(again.studentNotes).toEqual([]);
    expect((await save(c, { date, groupId: g1.id, homework: "習作", status: "draft", studentNotes: [{ studentId: other.id, text: "x" }] })).status).toBe(400);
    expect((await save(c, { date, groupId: g1.id, homework: "習作", status: "draft", studentNotes: [{ studentId: "nobody", text: "x" }] })).status).toBe(400);
  });

  it("只有個別加註、沒有全組內容時可以存草稿，不能發送", async () => {
    const { c, g1, s1 } = await setup();
    const date = "2026-12-08";
    const e = await ok(save(c, { date, groupId: g1.id, status: "draft", studentNotes: [{ studentId: s1.id, text: "忘了帶課本" }] }));
    expect(e.status).toBe("draft");
    expect((await save(c, { date, groupId: g1.id, status: "sent", studentNotes: [{ studentId: s1.id, text: "忘了帶課本" }] })).status).toBe(400);
  });

  it("檢查日期、組別、狀態與長度", async () => {
    const { c, g1 } = await setup();
    expect((await api(c, "GET", "/api/diary/2026-02-30")).status).toBe(400);
    expect((await save(c, { date: "2026/12/02", groupId: g1.id, homework: "x", status: "draft" })).status).toBe(400);
    expect((await save(c, { date: DAY, groupId: "nope", homework: "x", status: "draft" })).status).toBe(400);
    expect((await save(c, { date: DAY, groupId: g1.id, homework: "x", status: "published" })).status).toBe(400);
    expect((await save(c, { date: DAY, groupId: g1.id, homework: "x".repeat(501), status: "draft" })).status).toBe(400);
    expect((await save(c, { date: DAY, groupId: g1.id, note: "x".repeat(301), status: "draft" })).status).toBe(400);
  });

  it("停用的組不出現在當天的聯絡簿", async () => {
    const { c } = await setup();
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "停用的組" }));
    await ok(api(c, "PATCH", `/api/groups/${g.id}`, { active: false }));
    expect((await day(c)).entries.some((e) => e.groupId === g.id)).toBe(false);
    expect((await state(c)).groups.some((x) => x.id === g.id)).toBe(true);
  });
});
