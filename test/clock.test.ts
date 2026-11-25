import { describe, expect, it } from "vitest";
import { atClock, formatRemaining, parseClock, parseMinutes, remainingFraction, remainingMs, TIMER_MAX_MINUTES } from "../src/shared/clock";

// 以裝置的當地時間計算；用 new Date(年, 月, 日, 時, 分) 建時間，任何時區跑都一樣
const at = (h: number, m: number, s = 0) => new Date(2026, 10, 25, h, m, s).getTime();

describe("時刻解析", () => {
  it("接受 HH:MM 與 H:MM，也接受全形冒號", () => {
    expect(parseClock("10:30")).toEqual({ h: 10, m: 30 });
    expect(parseClock("9:05")).toEqual({ h: 9, m: 5 });
    expect(parseClock(" 08：40 ")).toEqual({ h: 8, m: 40 });
    expect(parseClock("00:00")).toEqual({ h: 0, m: 0 });
    expect(parseClock("23:59")).toEqual({ h: 23, m: 59 });
  });

  it("不合理的時刻回 null", () => {
    for (const bad of ["", "24:00", "10:60", "1030", "10:3", "ab:cd", "-1:30", "10:30:00", "１０:３０"]) {
      expect(parseClock(bad), bad).toBeNull();
    }
  });
});

describe("分鐘數", () => {
  it("1 到上限的整數分鐘才算數", () => {
    expect(parseMinutes("5")).toBe(5);
    expect(parseMinutes(" 45 ")).toBe(45);
    expect(parseMinutes(String(TIMER_MAX_MINUTES))).toBe(TIMER_MAX_MINUTES);
    for (const bad of ["", "0", "-3", "2.5", "abc", String(TIMER_MAX_MINUTES + 1)]) expect(parseMinutes(bad), bad).toBeNull();
  });
});

describe("倒數到指定時刻", () => {
  it("回傳今天那個時刻", () => {
    expect(atClock(at(10, 0), { h: 10, m: 30 })).toBe(at(10, 30));
    expect(atClock(at(23, 50), { h: 8, m: 0 })).toBe(at(8, 0));
  });

  it("剩餘時間不會小於 0", () => {
    expect(remainingMs(at(10, 30), at(10, 0))).toBe(30 * 60 * 1000);
    expect(remainingMs(at(10, 30), at(10, 31))).toBe(0);
  });
});

describe("剩餘比例（圓餅大小）", () => {
  it("開始是 1、結束是 0，中間依比例", () => {
    expect(remainingFraction(600_000, 600_000)).toBe(1);
    expect(remainingFraction(150_000, 600_000)).toBe(0.25);
    expect(remainingFraction(0, 600_000)).toBe(0);
  });

  it("超出範圍或總長為 0 時夾在 0 到 1", () => {
    expect(remainingFraction(700_000, 600_000)).toBe(1);
    expect(remainingFraction(-5, 600_000)).toBe(0);
    expect(remainingFraction(0, 0)).toBe(0);
  });
});

describe("剩餘時間文字", () => {
  it("不到一小時是 分:秒，秒數無條件進位（開始時顯示完整分鐘，最後一秒才到 0）", () => {
    expect(formatRemaining(5 * 60_000)).toBe("05:00");
    expect(formatRemaining(5 * 60_000 - 1)).toBe("05:00");
    expect(formatRemaining(61_001)).toBe("01:02");
    expect(formatRemaining(999)).toBe("00:01");
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-10)).toBe("00:00");
  });

  it("一小時以上是 時:分:秒", () => {
    expect(formatRemaining(60 * 60_000)).toBe("1:00:00");
    expect(formatRemaining(2 * 60 * 60_000 + 5 * 60_000 + 7_000)).toBe("2:05:07");
  });
});
