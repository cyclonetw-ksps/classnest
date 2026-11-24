import { describe, expect, it } from "vitest";
import type { Group, PointEvent, Reason, Reward, Student } from "../src/shared/types";
import { api, FIRST_TEACHER, login, ok, state } from "./helpers";

async function setup(cookie: string) {
  const group = await ok(api<Group>(cookie, "POST", "/api/groups", { name: `組-${crypto.randomUUID().slice(0, 6)}` }));
  const a = await ok(api<Student>(cookie, "POST", "/api/students", { displayName: "甲生", groupIds: [group.id] }));
  const b = await ok(api<Student>(cookie, "POST", "/api/students", { displayName: "乙生", groupIds: [group.id] }));
  const reason = await ok(api<Reason>(cookie, "POST", "/api/reasons", { label: "寫完作業", points: 2 }));
  return { group, a, b, reason };
}

const totalOf = async (cookie: string, id: string) => (await state(cookie)).students.find((s) => s.id === id)!.total;

describe("加分理由", () => {
  it("每個理由有自己的分數，可修改與停用", async () => {
    const c = await login(FIRST_TEACHER);
    const r = await ok(api<Reason>(c, "POST", "/api/reasons", { label: "課堂專心", points: 1 }));
    expect(r.points).toBe(1);
    await ok(api(c, "PATCH", `/api/reasons/${r.id}`, { points: 3, label: "很專心" }));
    await ok(api(c, "PATCH", `/api/reasons/${r.id}`, { active: false }));
    const found = (await state(c)).reasons.find((x) => x.id === r.id)!;
    expect(found).toMatchObject({ label: "很專心", points: 3, active: false });
  });

  it("分數必須是 1 到 100 的整數（不能扣分）", async () => {
    const c = await login(FIRST_TEACHER);
    for (const points of [0, -1, 101, 1.5, "2"]) {
      expect((await api(c, "POST", "/api/reasons", { label: "x", points })).status, String(points)).toBe(400);
    }
  });
});

describe("加分與撤銷", () => {
  it("按一下理由替一位學生加分，紀錄寫入加分老師與時間", async () => {
    const c = await login(FIRST_TEACHER);
    const { a, reason } = await setup(c);
    const before = Date.now();
    const res = await ok(api<{ events: PointEvent[] }>(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] }));
    expect(res.events).toHaveLength(1);
    expect(await totalOf(c, a.id)).toBe(2);
    const ev = (await state(c)).events.find((e) => e.id === res.events[0].id)!;
    expect(ev).toMatchObject({ studentId: a.id, studentName: "甲生", reasonLabel: "寫完作業", points: 2, teacherEmail: FIRST_TEACHER, undoneAt: null });
    expect(ev.createdAt).toBeGreaterThanOrEqual(before);
  });

  it("按一下理由替整組學生各加一次分，停用的學生不加", async () => {
    const c = await login(FIRST_TEACHER);
    const { group, a, b, reason } = await setup(c);
    const off = await ok(api<Student>(c, "POST", "/api/students", { displayName: "停用生", groupIds: [group.id] }));
    await ok(api(c, "PATCH", `/api/students/${off.id}`, { active: false }));
    const res = await ok(api<{ events: PointEvent[] }>(c, "POST", "/api/points", { reasonId: reason.id, groupId: group.id }));
    expect(res.events).toHaveLength(2);
    expect(await totalOf(c, a.id)).toBe(2);
    expect(await totalOf(c, b.id)).toBe(2);
    expect(await totalOf(c, off.id)).toBe(0);
  });

  it("撤銷一筆加分後累積分立即扣回，同一筆不能撤銷兩次", async () => {
    const c = await login(FIRST_TEACHER);
    const { a, reason } = await setup(c);
    await ok(api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] }));
    const res = await ok(api<{ events: PointEvent[] }>(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] }));
    expect(await totalOf(c, a.id)).toBe(4);
    await ok(api(c, "POST", `/api/points/${res.events[0].id}/undo`));
    expect(await totalOf(c, a.id)).toBe(2);
    const ev = (await state(c)).events.find((e) => e.id === res.events[0].id)!;
    expect(ev.undoneBy).toBe(FIRST_TEACHER);
    expect(ev.undoneAt).not.toBeNull();
    expect((await api(c, "POST", `/api/points/${res.events[0].id}/undo`)).status).toBe(409);
  });

  it("停用的理由不能用來加分，找不到的學生被拒絕", async () => {
    const c = await login(FIRST_TEACHER);
    const { a, reason } = await setup(c);
    expect((await api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: ["missing"] })).status).toBe(400);
    await ok(api(c, "PATCH", `/api/reasons/${reason.id}`, { active: false }));
    expect((await api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] })).status).toBe(400);
  });
});

describe("分數門檻與獎勵", () => {
  it("達到門檻解鎖、撤銷到門檻以下就改回未解鎖、已解鎖才可標記已發放", async () => {
    const c = await login(FIRST_TEACHER);
    const { a, reason } = await setup(c);
    const r4 = await ok(api<Reward>(c, "POST", "/api/rewards", { threshold: 4, title: "選座位一次" }));
    const r6 = await ok(api<Reward>(c, "POST", "/api/rewards", { threshold: 6, title: "當小老師" }));
    const rewardOf = async (rid: string) => (await state(c)).students.find((s) => s.id === a.id)!.rewards.find((x) => x.rewardId === rid)!;

    await ok(api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] }));
    expect((await rewardOf(r4.id)).unlocked).toBe(false);
    expect((await api(c, "POST", `/api/rewards/${r4.id}/grant`, { studentId: a.id })).status).toBe(409);

    const second = await ok(api<{ events: PointEvent[] }>(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] }));
    expect((await rewardOf(r4.id)).unlocked).toBe(true);
    expect((await rewardOf(r6.id)).unlocked).toBe(false);

    await ok(api(c, "POST", `/api/points/${second.events[0].id}/undo`));
    expect((await rewardOf(r4.id)).unlocked).toBe(false);

    await ok(api(c, "POST", "/api/points", { reasonId: reason.id, studentIds: [a.id] }));
    await ok(api(c, "POST", `/api/rewards/${r4.id}/grant`, { studentId: a.id }));
    const granted = await rewardOf(r4.id);
    expect(granted.unlocked).toBe(true);
    expect(granted.grantedAt).not.toBeNull();

    await ok(api(c, "POST", `/api/rewards/${r4.id}/ungrant`, { studentId: a.id }));
    expect((await rewardOf(r4.id)).grantedAt).toBeNull();
  });

  it("門檻必須是正整數，獎勵名稱不可空白", async () => {
    const c = await login(FIRST_TEACHER);
    expect((await api(c, "POST", "/api/rewards", { threshold: 0, title: "x" })).status).toBe(400);
    expect((await api(c, "POST", "/api/rewards", { threshold: 10, title: " " })).status).toBe(400);
  });
});
