// 日期與週（純函式，前後端共用）。日期一律是 YYYY-MM-DD 字串，用 UTC 換算，避免時區把日期推前推後。
// 一週以週一的日期代表；課表只有週一到週五。

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const WEEKDAY_NAMES = ["", "週一", "週二", "週三", "週四", "週五"];

export function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(t).toISOString().slice(0, 10) === value ? value : null;
}

function utc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

// 週一是 1、週日是 7
export function weekdayOf(date: string): number {
  return new Date(utc(date)).getUTCDay() || 7;
}

export function isWeekStart(value: unknown): boolean {
  const d = parseDate(value);
  return d !== null && weekdayOf(d) === 1;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

export function weekDates(monday: string): { weekday: number; date: string }[] {
  return WEEKDAYS.map((weekday) => ({ weekday, date: addDays(monday, weekday - 1) }));
}

// 裝置當地的日期
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
