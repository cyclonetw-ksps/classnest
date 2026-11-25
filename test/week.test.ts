import { describe, expect, it } from "vitest";
import { addDays, isWeekStart, localDate, mondayOf, parseDate, weekDates } from "../src/shared/week";

describe("日期與週", () => {
  it("parseDate 只收有效的 YYYY-MM-DD", () => {
    expect(parseDate("2026-11-23")).toBe("2026-11-23");
    for (const bad of ["", "2026-2-3", "2026-02-30", "2026-13-01", "20261123", "2026-11-23T00:00", 123]) {
      expect(parseDate(bad as string), String(bad)).toBeNull();
    }
  });

  it("週的代表日期一定是週一", () => {
    expect(isWeekStart("2026-11-23")).toBe(true); // 週一
    expect(isWeekStart("2026-11-24")).toBe(false);
    expect(isWeekStart("2026-11-29")).toBe(false); // 週日
    expect(isWeekStart("2026-02-30")).toBe(false);
  });

  it("mondayOf 找到那一週的週一；週日算前一週", () => {
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(mondayOf("2026-11-27")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("addDays 跨月、跨年都對", () => {
    expect(addDays("2026-11-30", -7)).toBe("2026-11-23");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2024-02-26", 3)).toBe("2024-02-29");
  });

  it("weekDates 回週一到週五", () => {
    expect(weekDates("2026-11-23")).toEqual([
      { weekday: 1, date: "2026-11-23" },
      { weekday: 2, date: "2026-11-24" },
      { weekday: 3, date: "2026-11-25" },
      { weekday: 4, date: "2026-11-26" },
      { weekday: 5, date: "2026-11-27" },
    ]);
  });

  it("localDate 用裝置的當地日期", () => {
    expect(localDate(new Date(2026, 10, 25, 23, 59))).toBe("2026-11-25");
    expect(localDate(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });
});
