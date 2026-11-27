import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClassState, Device, Group, KioskRoster, LoginCards, Reason, Reward, Student, StudentView } from "../src/shared/types";
import { api, call, FIRST_TEACHER, login, ok, state } from "./helpers";

// 老師在「這台」按設成學生平板：回傳學生平板憑證（cookie 字串）與完整的 set-cookie
async function enroll(teacher: string, mode: "shared" | "personal" = "shared", name = "教室平板") {
  const res = await call("/api/devices", { method: "POST", cookie: teacher, json: { name, mode } });
  const cookies = res.headers.getSetCookie();
  const body = (await res.json()) as { device: Device };
  if (res.status !== 200) throw new Error(`enroll failed ${res.status}: ${JSON.stringify(body)}`);
  const device = cookies.find((c) => c.startsWith("cn_device="))!;
  return { status: res.status, cookies, device: device.split(";")[0], setCookie: device, id: body.device.id, body };
}

async function studentLogin(device: string, studentId: string, cards: number[], origin?: string) {
  const res = await call("/api/student/login", {
    method: "POST",
    cookie: device,
    json: { studentId, cards },
    headers: origin ? { origin } : undefined,
  });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("cn_student=")) ?? "";
  return { status: res.status, setCookie, cookie: setCookie.split(";")[0], body: (await res.json().catch(() => null)) as { error?: string } | null };
}

const both = (device: string, student: string) => `${device}; ${student}`;
const cardsOf = (c: string, studentId: string) => ok(api<{ cards: number[] }>(c, "POST", `/api/students/${studentId}/cards`));
const wrong = (cards: number[]) => [cards[1], cards[0], cards[2]];

let ready: Promise<{ c: string; g1: Group; g2: Group; off: Group; s1: Student; s2: Student; nocards: Student; gone: Student }> | null = null;
function setup() {
  ready ??= (async () => {
    const c = await login(FIRST_TEACHER);
    const g1 = await ok(api<Group>(c, "POST", "/api/groups", { name: "登入 A 組" }));
    const g2 = await ok(api<Group>(c, "POST", "/api/groups", { name: "登入 B 組" }));
    const off = await ok(api<Group>(c, "POST", "/api/groups", { name: "停用的組" }));
    await ok(api(c, "PATCH", `/api/groups/${off.id}`, { active: false }));
    const s1 = await ok(api<Student>(c, "POST", "/api/students", { displayName: "登入小明", homeClass: "三年二班", homeroomTeacher: "林老師", groupIds: [g1.id] }));
    const s2 = await ok(api<Student>(c, "POST", "/api/students", { displayName: "登入小華", groupIds: [g1.id, g2.id] }));
    const nocards = await ok(api<Student>(c, "POST", "/api/students", { displayName: "還沒有密碼", groupIds: [g2.id] }));
    const gone = await ok(api<Student>(c, "POST", "/api/students", { displayName: "停用的學生", groupIds: [g1.id] }));
    await cardsOf(c, gone.id);
    await ok(api(c, "PATCH", `/api/students/${gone.id}`, { active: false }));
    return { c, g1, g2, off, s1, s2, nocards, gone };
  })();
  return ready;
}

afterEach(() => vi.useRealTimers());

describe("學生平板", () => {
  it("沒有學生平板憑證時讀不到名單、不能登入；老師的登入也不行", async () => {
    const { c, s1 } = await setup();
    expect((await call("/api/student/roster")).status).toBe(401);
    expect((await call("/api/student/roster", { cookie: c })).status).toBe(401);
    expect((await call("/api/student/login", { method: "POST", json: { studentId: s1.id, cards: [0, 1, 2] } })).status).toBe(401);
    expect((await call("/api/student/login", { method: "POST", cookie: c, json: { studentId: s1.id, cards: [0, 1, 2] } })).status).toBe(401);
    expect((await call("/api/student/me")).status).toBe(401);
  });

  it("老師把這台設成學生平板：拿到 HttpOnly 憑證，同時登出這台的老師", async () => {
    const teacher = await login(FIRST_TEACHER);
    const r = await enroll(teacher, "shared", "國語角平板");
    expect(r.setCookie).toMatch(/HttpOnly/i);
    expect(r.setCookie).toMatch(/Secure/i);
    expect(r.setCookie).toMatch(/SameSite=Lax/i);
    expect(r.cookies.some((x) => /^cn_session=;/.test(x) && /Max-Age=0/.test(x))).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain(r.device.split("=")[1]);
    expect((await call("/api/me", { cookie: teacher })).status).toBe(401);
    const other = await login(FIRST_TEACHER);
    const d = (await state(other)).devices.find((x) => x.id === r.id)!;
    expect(d).toMatchObject({ name: "國語角平板", mode: "shared", studentName: null });
  });

  it("學生平板憑證不能用任何老師 API", async () => {
    const { c, s1 } = await setup();
    const { device } = await enroll(await login(FIRST_TEACHER));
    expect((await call("/api/state", { cookie: device })).status).toBe(401);
    expect((await call("/api/points", { method: "POST", cookie: device, json: { reasonId: "x", studentIds: [s1.id] } })).status).toBe(401);
    expect((await call(`/api/students/${s1.id}/cards`, { method: "POST", cookie: device })).status).toBe(401);
    expect((await call("/api/login-cards", { cookie: device })).status).toBe(401);
    expect((await state(c)).students.length).toBeGreaterThan(0);
  });

  it("名單只有使用中的組與學生，只有顯示名與組別，沒有分數、原班、導師", async () => {
    const { c, g1, g2, off, s1, s2, nocards, gone } = await setup();
    await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    const roster = await ok(api<KioskRoster>(device, "GET", "/api/student/roster"));
    expect(roster.mode).toBe("shared");
    expect(roster.groups.map((g) => g.id)).toEqual(expect.arrayContaining([g1.id, g2.id]));
    expect(roster.groups.some((g) => g.id === off.id)).toBe(false);
    // 色紙位置照全部組別（含停用）的建立順序，和老師端一致
    const all = (await state(c)).groups.map((g) => g.id);
    expect(roster.groups.find((g) => g.id === g2.id)!.color).toBe(all.indexOf(g2.id));
    const ids = roster.students.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([s1.id, s2.id, nocards.id]));
    expect(ids).not.toContain(gone.id);
    expect(roster.students.find((s) => s.id === s1.id)).toEqual({ id: s1.id, displayName: "登入小明", groupIds: [g1.id], ready: true });
    expect(roster.students.find((s) => s.id === nocards.id)!.ready).toBe(false);
    const raw = JSON.stringify(roster);
    expect(raw).not.toContain("三年二班");
    expect(raw).not.toContain("林老師");
    expect(raw).not.toContain("total");
  });
});

describe("圖卡密碼", () => {
  it("老師產生 3 張不重複的圖卡；可以重新產生；印圖卡密碼列出使用中的學生", async () => {
    const { c, s1, nocards, gone } = await setup();
    const first = await cardsOf(c, s1.id);
    expect(first.cards).toHaveLength(3);
    expect(new Set(first.cards).size).toBe(3);
    expect(first.cards.every((x) => Number.isInteger(x) && x >= 0 && x < 9)).toBe(true);
    const s = (await state(c)).students;
    expect(s.find((x) => x.id === s1.id)!.hasCards).toBe(true);
    expect(s.find((x) => x.id === nocards.id)!.hasCards).toBe(false);
    // state 不帶密碼本身
    expect(JSON.stringify(s)).not.toContain('"cards"');
    const list = await ok(api<LoginCards[]>(c, "GET", "/api/login-cards"));
    const mine = list.find((x) => x.studentId === s1.id)!;
    expect(mine.cards).toEqual(first.cards);
    expect(list.some((x) => x.studentId === nocards.id)).toBe(false);
    expect(list.some((x) => x.studentId === gone.id)).toBe(false);
    expect((await api(c, "POST", "/api/students/nobody/cards")).status).toBe(404);
  });

  it("依序點對 3 張才能登入；順序錯、張數錯都不行", async () => {
    const { c, s1 } = await setup();
    const { cards } = await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    expect((await studentLogin(device, s1.id, wrong(cards))).status).toBe(401);
    expect((await studentLogin(device, s1.id, cards.slice(0, 2))).status).toBe(400);
    expect((await studentLogin(device, s1.id, [cards[0], cards[0], cards[1]])).status).toBe(400);
    const r = await studentLogin(device, s1.id, cards);
    expect(r.status).toBe(200);
    expect(r.setCookie).toMatch(/HttpOnly/i);
    expect(r.setCookie).toMatch(/Max-Age=600/);
  });

  it("還沒有圖卡密碼、停用或不存在的學生不能登入", async () => {
    const { nocards, gone } = await setup();
    const { device } = await enroll(await login(FIRST_TEACHER));
    const r = await studentLogin(device, nocards.id, [0, 1, 2]);
    expect(r.status).toBe(401);
    expect(r.body?.error).toContain("老師");
    expect((await studentLogin(device, gone.id, [0, 1, 2])).status).toBe(401);
    expect((await studentLogin(device, "nobody", [0, 1, 2])).status).toBe(401);
  });

  it("連錯 5 次暫停 5 分鐘，對的也不行；時間到或老師重新產生就解除", async () => {
    const { c, g1 } = await setup();
    const kid = await ok(api<Student>(c, "POST", "/api/students", { displayName: "常按錯", groupIds: [g1.id] }));
    const { cards } = await cardsOf(c, kid.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    for (let i = 0; i < 5; i++) expect((await studentLogin(device, kid.id, wrong(cards))).status).toBe(401);
    const locked = await studentLogin(device, kid.id, cards);
    expect(locked.status).toBe(429);
    expect(locked.cookie).toBe("");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1000);
    expect((await studentLogin(device, kid.id, cards)).status).toBe(200);
    vi.useRealTimers();
    for (let i = 0; i < 5; i++) await studentLogin(device, kid.id, wrong(cards));
    expect((await studentLogin(device, kid.id, cards)).status).toBe(429);
    const fresh = await cardsOf(c, kid.id);
    expect((await studentLogin(device, kid.id, fresh.cards)).status).toBe(200);
  });

  it("跨站送來的登入被擋", async () => {
    const { c, s1 } = await setup();
    const { cards } = await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    expect((await studentLogin(device, s1.id, cards, "https://evil.example.com")).status).toBe(403);
  });
});

describe("學生頁", () => {
  it("只看得到自己的分數與獎勵進度", async () => {
    const { c, s1, s2 } = await setup();
    const reason = await ok(api<Reason>(c, "POST", "/api/reasons", { label: "專心", points: 3 }));
    const reward = await ok(api<Reward>(c, "POST", "/api/rewards", { threshold: 3, title: "選座位" }));
    const big = await ok(api<Reward>(c, "POST", "/api/rewards", { threshold: 99999, title: "很遠的獎勵" }));
    await ok(api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [s1.id] }));
    await ok(api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [s2.id] }));
    await ok(api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [s2.id] }));
    await ok(api(c, "POST", `/api/rewards/${reward.id}/grant`, { studentId: s1.id }));
    const { cards } = await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    const { cookie } = await studentLogin(device, s1.id, cards);
    const me = await ok(api<StudentView>(both(device, cookie), "GET", "/api/student/me"));
    const expected = (await state(c)).students.find((s) => s.id === s1.id)!.total;
    expect(me).toMatchObject({ displayName: "登入小明", total: expected, mode: "shared" });
    expect(me.rewards.find((r) => r.id === reward.id)).toEqual({ id: reward.id, title: "選座位", threshold: 3, unlocked: true, granted: true });
    expect(me.rewards.find((r) => r.id === big.id)).toMatchObject({ unlocked: false, granted: false });
    const raw = JSON.stringify(me);
    expect(raw).not.toContain("登入小華");
    expect(raw).not.toContain(s2.id);
    expect(raw).not.toContain(FIRST_TEACHER);
    expect(raw).not.toContain("三年二班");
  });

  it("看得到所屬組最近一次已發送的聯絡簿與給自己的加註；看不到草稿與別人的加註", async () => {
    const { c, g1, g2, s1, s2 } = await setup();
    await ok(api(c, "PUT", "/api/diary", { date: "2026-12-01", groupId: g1.id, homework: "舊的作業", status: "sent" }));
    await ok(
      api(c, "PUT", "/api/diary", {
        date: "2026-12-02",
        groupId: g1.id,
        homework: "習作 p.10",
        bring: "直笛",
        status: "sent",
        studentNotes: [
          { studentId: s1.id, text: "給小明的話" },
          { studentId: s2.id, text: "給小華的悄悄話" },
        ],
      }),
    );
    await ok(api(c, "PUT", "/api/diary", { date: "2026-12-03", groupId: g1.id, homework: "還是草稿", status: "draft" }));
    await ok(api(c, "PUT", "/api/diary", { date: "2026-12-02", groupId: g2.id, homework: "B 組的", status: "sent" }));
    const { cards } = await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    const { cookie } = await studentLogin(device, s1.id, cards);
    const me = await ok(api<StudentView>(both(device, cookie), "GET", "/api/student/me"));
    const color = (await state(c)).groups.findIndex((g) => g.id === g1.id);
    expect(me.diary).toEqual([
      { date: "2026-12-02", groupId: g1.id, groupName: "登入 A 組", color, homework: "習作 p.10", bring: "直笛", note: "", myNote: "給小明的話" },
    ]);
    const raw = JSON.stringify(me);
    expect(raw).not.toContain("給小華的悄悄話");
    expect(raw).not.toContain("還是草稿");
    expect(raw).not.toContain("B 組的");
  });

  it("學生的登入不能用任何老師 API，換到別台平板也不能用", async () => {
    const { c, s1 } = await setup();
    const { cards } = await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    const { cookie } = await studentLogin(device, s1.id, cards);
    const kid = both(device, cookie);
    expect((await call("/api/state", { cookie: kid })).status).toBe(401);
    expect((await call("/api/me", { cookie: kid })).status).toBe(401);
    expect((await call("/api/points", { method: "POST", cookie: kid, json: { reasonId: "x", studentIds: [s1.id] } })).status).toBe(401);
    expect((await call("/api/login-cards", { cookie: kid })).status).toBe(401);
    // 學生憑證要和登入時那台平板一起才有效
    expect((await call("/api/student/me", { cookie })).status).toBe(401);
    const other = await enroll(await login(FIRST_TEACHER));
    expect((await call("/api/student/me", { cookie: both(other.device, cookie) })).status).toBe(401);
  });

  it("登出後失效；共用平板 10 分鐘後失效", async () => {
    const { c, s1 } = await setup();
    const { cards } = await cardsOf(c, s1.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    const a = await studentLogin(device, s1.id, cards);
    const res = await call("/api/student/logout", { method: "POST", cookie: both(device, a.cookie) });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((x) => /^cn_student=;/.test(x) && /Max-Age=0/.test(x))).toBe(true);
    expect((await call("/api/student/me", { cookie: both(device, a.cookie) })).status).toBe(401);
    // 登出只登出學生，平板還是學生平板
    expect((await call("/api/student/roster", { cookie: device })).status).toBe(200);
    const b = await studentLogin(device, s1.id, cards);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1000);
    expect((await call("/api/student/me", { cookie: both(device, b.cookie) })).status).toBe(401);
  });

  it("個人平板一直記住；換另一位學生登入時，前一位就登出；老師看得到是誰", async () => {
    const { c, s1, s2 } = await setup();
    const one = await cardsOf(c, s1.id);
    const two = await cardsOf(c, s2.id);
    const p = await enroll(await login(FIRST_TEACHER), "personal", "小明的平板");
    const a = await studentLogin(p.device, s1.id, one.cards);
    expect(a.setCookie).toMatch(/Max-Age=34560000/);
    expect((await ok(api<StudentView>(both(p.device, a.cookie), "GET", "/api/student/me"))).mode).toBe("personal");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect((await call("/api/student/me", { cookie: both(p.device, a.cookie) })).status).toBe(200);
    vi.useRealTimers();
    expect((await state(c)).devices.find((d) => d.id === p.id)!.studentName).toBe("登入小明");
    const b = await studentLogin(p.device, s2.id, two.cards);
    expect((await call("/api/student/me", { cookie: both(p.device, a.cookie) })).status).toBe(401);
    expect((await call("/api/student/me", { cookie: both(p.device, b.cookie) })).status).toBe(200);
  });

  it("老師登出某台學生平板：那台與上面登入的學生立即失效；也可以改名", async () => {
    const { c, s1 } = await setup();
    const { cards } = await cardsOf(c, s1.id);
    const d = await enroll(await login(FIRST_TEACHER), "personal");
    const kid = await studentLogin(d.device, s1.id, cards);
    await ok(api(c, "PATCH", `/api/devices/${d.id}`, { name: "改過的名字" }));
    expect((await state(c)).devices.find((x) => x.id === d.id)!.name).toBe("改過的名字");
    await ok(api(c, "DELETE", `/api/devices/${d.id}`));
    expect((await call("/api/student/roster", { cookie: d.device })).status).toBe(401);
    expect((await call("/api/student/me", { cookie: both(d.device, kid.cookie) })).status).toBe(401);
    expect((await state(c)).devices.some((x) => x.id === d.id)).toBe(false);
    expect((await api(c, "DELETE", `/api/devices/${d.id}`)).status).toBe(404);
  });

  it("學生被停用後立即失效", async () => {
    const { c, g1 } = await setup();
    const kid = await ok(api<Student>(c, "POST", "/api/students", { displayName: "要停用", groupIds: [g1.id] }));
    const { cards } = await cardsOf(c, kid.id);
    const { device } = await enroll(await login(FIRST_TEACHER));
    const { cookie } = await studentLogin(device, kid.id, cards);
    await ok(api(c, "PATCH", `/api/students/${kid.id}`, { active: false }));
    expect((await call("/api/student/me", { cookie: both(device, cookie) })).status).toBe(401);
  });

  it("檢查平板名稱與模式", async () => {
    const teacher = await login(FIRST_TEACHER);
    expect((await api(teacher, "POST", "/api/devices", { name: "", mode: "shared" })).status).toBe(400);
    expect((await api(teacher, "POST", "/api/devices", { name: "x", mode: "kiosk" })).status).toBe(400);
    expect((await api(teacher, "POST", "/api/devices", { name: "x".repeat(21), mode: "shared" })).status).toBe(400);
    expect((await call("/api/me", { cookie: teacher })).status).toBe(200);
  });
});

// ClassState 一定要有 devices，前端才能列出來
export type _HasDevices = ClassState["devices"];
