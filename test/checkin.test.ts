import { env as rawEnv } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckinView, Group, Student, StudentView } from "../src/shared/types";
import { api, both, call, enroll, FIRST_TEACHER, login, ok, state, studentLogin } from "./helpers";

const MIN = 60 * 1000;
const env = rawEnv as unknown as { CLASSROOM: DurableObjectNamespace };

// 一位學生在共用平板上登入好的 cookie
async function kid(c: string, name: string, groupId: string) {
  const s = await ok(api<Student>(c, "POST", "/api/students", { displayName: name, groupIds: [groupId] }));
  const { cards } = await ok(api<{ cards: number[] }>(c, "POST", `/api/students/${s.id}/cards`));
  const { device } = await enroll(await login(FIRST_TEACHER));
  const r = await studentLogin(device, s.id, cards);
  return { s, cookie: both(device, r.cookie), device, cards };
}

let ready: Promise<{ c: string; g: Group }> | null = null;
function setup() {
  ready ??= (async () => {
    const c = await login(FIRST_TEACHER);
    const g = await ok(api<Group>(c, "POST", "/api/groups", { name: "簽到組" }));
    return { c, g };
  })();
  return ready;
}

const view = (c: string) => ok(api<CheckinView>(c, "GET", "/api/checkin"));
const checkin = (cookie: string) => call("/api/student/checkin", { method: "POST", cookie });
const me = (cookie: string) => ok(api<StudentView>(cookie, "GET", "/api/student/me"));

afterEach(async () => {
  vi.useRealTimers();
  const { c } = await setup();
  await api(c, "POST", "/api/checkin/close");
});

describe("簽到", () => {
  it("未登入、學生平板與學生的登入都不能開放或關閉簽到，也讀不到名單", async () => {
    const { c, g } = await setup();
    const k = await kid(c, "不能開放的", g.id);
    for (const cookie of [undefined, k.device, k.cookie]) {
      expect((await call("/api/checkin", { cookie })).status).toBe(401);
      expect((await call("/api/checkin/open", { method: "POST", cookie, json: {} })).status).toBe(401);
      expect((await call("/api/checkin/close", { method: "POST", cookie })).status).toBe(401);
    }
    expect((await call("/api/student/checkin", { method: "POST" })).status).toBe(401);
    expect((await call("/api/student/checkin", { method: "POST", cookie: k.device })).status).toBe(401);
  });

  it("沒開放時學生簽不了；老師開放後（預設 10 分鐘）可以簽，同一次開放只算一次", async () => {
    const { c, g } = await setup();
    const k = await kid(c, "小簽", g.id);
    const no = await checkin(k.cookie);
    expect(no.status).toBe(409);
    expect(((await no.json()) as { error: string }).error).toContain("還沒開放");
    expect((await me(k.cookie)).checkin).toEqual({ open: false, closesAt: null, checkedIn: false });

    const before = Date.now();
    const opened = await ok(api<CheckinView>(c, "POST", "/api/checkin/open", {}));
    expect(opened.window!.open).toBe(true);
    expect(opened.window!.closesAt).toBeGreaterThanOrEqual(before + 10 * MIN);
    expect(opened.window!.closesAt).toBeLessThan(before + 11 * MIN);
    expect((await me(k.cookie)).checkin).toMatchObject({ open: true, checkedIn: false });

    expect((await checkin(k.cookie)).status).toBe(200);
    expect((await checkin(k.cookie)).status).toBe(200);
    const v = await view(c);
    expect(v.checkins.filter((x) => x.studentId === k.s.id)).toHaveLength(1);
    expect(v.checkins.find((x) => x.studentId === k.s.id)).toMatchObject({ displayName: "小簽" });
    expect((await me(k.cookie)).checkin.checkedIn).toBe(true);
    // 名單只有顯示名與時間，沒有分數或其他欄位
    expect(Object.keys(v.checkins[0]).sort()).toEqual(["at", "displayName", "id", "studentId"]);
    expect((await state(c)).checkin.window?.open).toBe(true);
  });

  it("可以指定分鐘數；超出範圍不行", async () => {
    const { c } = await setup();
    const before = Date.now();
    const v = await ok(api<CheckinView>(c, "POST", "/api/checkin/open", { minutes: 3 }));
    expect(v.window!.closesAt).toBeLessThan(before + 4 * MIN);
    for (const minutes of [0, 61, 2.5, "5"]) expect((await api(c, "POST", "/api/checkin/open", { minutes })).status).toBe(400);
  });

  it("時間到自動關閉；老師也可以提早關閉", async () => {
    const { c, g } = await setup();
    const a = await kid(c, "晚到的", g.id);
    await ok(api(c, "POST", "/api/checkin/open", { minutes: 5 }));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * MIN + 1000);
    expect((await checkin(a.cookie)).status).toBe(409);
    expect((await view(c)).window!.open).toBe(false);
    vi.useRealTimers();

    await ok(api(c, "POST", "/api/checkin/open", {}));
    const closed = await ok(api<CheckinView>(c, "POST", "/api/checkin/close"));
    expect(closed.window!.open).toBe(false);
    expect((await checkin(a.cookie)).status).toBe(409);
  });

  it("老師可以撤銷一筆簽到；撤銷後那位學生可以再簽", async () => {
    const { c, g } = await setup();
    const a = await kid(c, "被撤銷的", g.id);
    await ok(api(c, "POST", "/api/checkin/open", {}));
    await checkin(a.cookie);
    const id = (await view(c)).checkins.find((x) => x.studentId === a.s.id)!.id;
    await ok(api(c, "POST", `/api/checkins/${id}/undo`));
    expect((await view(c)).checkins.some((x) => x.studentId === a.s.id)).toBe(false);
    expect((await me(a.cookie)).checkin.checkedIn).toBe(false);
    expect((await api(c, "POST", `/api/checkins/${id}/undo`)).status).toBe(409);
    expect((await api(c, "POST", "/api/checkins/nope/undo")).status).toBe(404);
    expect((await checkin(a.cookie)).status).toBe(200);
    expect((await view(c)).checkins.filter((x) => x.studentId === a.s.id)).toHaveLength(1);
  });

  it("開放中再按一次只會延長時間；關掉再開是新的一次，要重新簽", async () => {
    const { c, g } = await setup();
    const a = await kid(c, "兩次的", g.id);
    const first = await ok(api<CheckinView>(c, "POST", "/api/checkin/open", { minutes: 2 }));
    await checkin(a.cookie);
    const again = await ok(api<CheckinView>(c, "POST", "/api/checkin/open", { minutes: 10 }));
    expect(again.window!.id).toBe(first.window!.id);
    expect(again.window!.closesAt).toBeGreaterThan(first.window!.closesAt);
    expect(again.checkins.some((x) => x.studentId === a.s.id)).toBe(true);

    await ok(api(c, "POST", "/api/checkin/close"));
    const next = await ok(api<CheckinView>(c, "POST", "/api/checkin/open", {}));
    expect(next.window!.id).not.toBe(first.window!.id);
    expect(next.checkins.some((x) => x.studentId === a.s.id)).toBe(false);
    expect((await me(a.cookie)).checkin.checkedIn).toBe(false);
  });

  it("停用的學生不會出現在名單上", async () => {
    const { c, g } = await setup();
    const a = await kid(c, "簽了又停用", g.id);
    await ok(api(c, "POST", "/api/checkin/open", {}));
    await checkin(a.cookie);
    await ok(api(c, "PATCH", `/api/students/${a.s.id}`, { active: false }));
    expect((await view(c)).checkins.some((x) => x.studentId === a.s.id)).toBe(false);
  });

  it("30 天前的簽到紀錄會自動刪除", async () => {
    const { c, g } = await setup();
    const a = await kid(c, "很久以前的", g.id);
    await ok(api(c, "POST", "/api/checkin/open", {}));
    await checkin(a.cookie);
    await ok(api(c, "POST", "/api/checkin/close"));
    const count = () =>
      runInDurableObject(env.CLASSROOM.get(env.CLASSROOM.idFromName("classroom")), (_obj, state) => {
        return state.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM checkins WHERE student_id = ?", a.s.id).one().n;
      });
    expect(await count()).toBe(1);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 29 * 24 * 60 * MIN);
    await ok(api(c, "POST", "/api/checkin/open", {}));
    expect(await count()).toBe(1);
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * MIN);
    // 老師的登入 30 天後也過期了，重新登入
    await ok(api(await login(FIRST_TEACHER), "POST", "/api/checkin/open", {}));
    expect(await count()).toBe(0);
  });
});
