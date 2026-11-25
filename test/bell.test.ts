import { describe, expect, it } from "vitest";
import { BEFORE_WINDOW_MS, bellAt, bellChimes, bellKey, STALE_MS, type BellLesson } from "../src/shared/bell";
import type { Period } from "../src/shared/types";

// 2026-11-25 是週三；用當地時間建時刻，任何時區跑都一樣
const at = (h: number, m: number, s = 0) => new Date(2026, 10, 25, h, m, s).getTime();
const MIN = 60_000;

const periods: Period[] = [
  { id: "p1", label: "第一節", start: "08:40", end: "09:20" },
  { id: "p2", label: "第二節", start: "09:30", end: "10:10" },
  { id: "p3", label: "第三節", start: "10:10", end: "10:50" }, // 和第二節相接
];
const lesson = (periodId: string, extra: Partial<BellLesson> = {}): BellLesson => ({
  periodId,
  groupId: "g1",
  subject: "國語",
  bring: "國語課本",
  cancelled: false,
  note: "",
  ...extra,
});
const lessons = [lesson("p1"), lesson("p2", { groupId: "g2", subject: "數學", bring: "量角器" })];

describe("依課表判斷現在", () => {
  it("上課中：這一節，倒數到下課", () => {
    const b = bellAt(at(8, 50), 3, periods, lessons);
    expect(b).toMatchObject({ kind: "class", period: { id: "p1" }, lesson: { subject: "國語" }, endsAt: at(9, 20), total: 40 * MIN });
  });

  it("下課：倒數到下一節上課，帶出下一節的課（含要帶的東西）", () => {
    const b = bellAt(at(9, 25), 3, periods, lessons);
    expect(b).toMatchObject({ kind: "break", period: { id: "p2" }, lesson: { subject: "數學", bring: "量角器" }, endsAt: at(9, 30), total: 10 * MIN });
  });

  it("剛好下課那一刻算下課；剛好上課那一刻算上課", () => {
    expect(bellAt(at(9, 20), 3, periods, lessons)).toMatchObject({ kind: "break", period: { id: "p2" } });
    expect(bellAt(at(9, 30), 3, periods, lessons)).toMatchObject({ kind: "class", period: { id: "p2" } });
  });

  it("相接的節次直接接上一節，不會出現長度 0 的下課", () => {
    expect(bellAt(at(10, 10), 3, periods, lessons)).toMatchObject({ kind: "class", period: { id: "p3" }, lesson: null });
  });

  it("第一節之前：倒數到第一節，總長最多看前 15 分鐘", () => {
    const b = bellAt(at(7, 50), 3, periods, lessons);
    expect(b).toMatchObject({ kind: "before", period: { id: "p1" }, endsAt: at(8, 40), total: BEFORE_WINDOW_MS });
    expect(BEFORE_WINDOW_MS).toBe(15 * MIN);
  });

  it("最後一節結束後是放學", () => {
    expect(bellAt(at(10, 50), 3, periods, lessons)).toEqual({ kind: "after" });
    expect(bellAt(at(16, 0), 3, periods, lessons)).toEqual({ kind: "after" });
  });

  it("週末與沒有節次各自說明", () => {
    expect(bellAt(at(9, 0), 6, periods, lessons)).toEqual({ kind: "weekend" });
    expect(bellAt(at(9, 0), 7, periods, lessons)).toEqual({ kind: "weekend" });
    expect(bellAt(at(9, 0), 3, [], [])).toEqual({ kind: "no-periods" });
  });

  it("停課的節次照樣算時間，課的資料帶著停課與原因", () => {
    const b = bellAt(at(9, 25), 3, periods, [lesson("p2", { cancelled: true, note: "校外教學" })]);
    expect(b).toMatchObject({ kind: "break", period: { id: "p2" }, lesson: { cancelled: true, note: "校外教學" } });
  });

  it("節次順序亂掉也照時間判斷", () => {
    const shuffled = [periods[2], periods[0], periods[1]];
    expect(bellAt(at(9, 25), 3, shuffled, lessons)).toMatchObject({ kind: "break", period: { id: "p2" } });
  });
});

describe("提示音", () => {
  const key = (h: number, m: number) => bellKey(bellAt(at(h, m), 3, periods, lessons));

  it("上課與下課的那一刻響", () => {
    expect(bellChimes(key(9, 29), key(9, 30))).toBe(true); // 上課
    expect(bellChimes(key(9, 19), key(9, 20))).toBe(true); // 下課
    expect(bellChimes(key(10, 9), key(10, 10))).toBe(true); // 相接：換到下一節
    expect(bellChimes(key(10, 49), key(10, 50))).toBe(true); // 最後一節下課
  });

  it("同一段之中、第一次打開、第一節前進到第一節前都不響", () => {
    expect(bellChimes(key(8, 50), key(8, 51))).toBe(false);
    expect(bellChimes(null, key(8, 50))).toBe(false);
    expect(bellChimes(key(7, 0), key(8, 0))).toBe(false);
    expect(bellChimes(key(16, 0), key(17, 0))).toBe(false);
  });

  it("分頁在背景很久、回來時才發現跨過上下課：不補響過期的提示音", () => {
    expect(STALE_MS).toBe(5_000);
    expect(bellChimes(key(9, 29), key(9, 30), 250)).toBe(true);
    expect(bellChimes(key(9, 29), key(9, 30), 4_000)).toBe(true);
    expect(bellChimes(key(9, 0), key(9, 30), 30 * MIN)).toBe(false);
  });
});
