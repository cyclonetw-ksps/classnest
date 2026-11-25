// 大螢幕「依課表」：用現在時刻、星期、節次與今天各節的課，判斷現在是上課、下課還是放學，
// 以及要倒數到哪一刻。純函式，畫面與測試共用。時刻用裝置的當地時間（沿用 clock.ts）。
import { atClock, parseClock } from "./clock";
import type { Lesson, Period } from "./types";

// 第一節之前，圓餅只看最後 15 分鐘（再早就一直是滿的）
export const BEFORE_WINDOW_MS = 15 * 60 * 1000;

export type BellLesson = Pick<Lesson, "periodId" | "groupId" | "subject" | "bring" | "cancelled" | "note">;

export type Bell =
  | { kind: "no-periods" }
  | { kind: "weekend" }
  | { kind: "after" }
  // class：period 是這一節，倒數到下課；break／before：period 是下一節，倒數到上課
  | { kind: "class" | "break" | "before"; period: Period; lesson: BellLesson | null; endsAt: number; total: number };

function times(now: number, p: Period) {
  const start = parseClock(p.start);
  const end = parseClock(p.end);
  return start && end ? { start: atClock(now, start), end: atClock(now, end) } : null;
}

// weekday：1 是週一，7 是週日
export function bellAt(now: number, weekday: number, periods: Period[], lessons: BellLesson[]): Bell {
  if (periods.length === 0) return { kind: "no-periods" };
  if (weekday >= 6) return { kind: "weekend" };
  const timed = periods
    .map((p) => ({ p, t: times(now, p) }))
    .filter((x): x is { p: Period; t: { start: number; end: number } } => !!x.t)
    .sort((a, b) => a.t.start - b.t.start);
  const lessonOf = (p: Period) => lessons.find((l) => l.periodId === p.id) ?? null;

  const current = timed.find((x) => x.t.start <= now && now < x.t.end);
  if (current) {
    return { kind: "class", period: current.p, lesson: lessonOf(current.p), endsAt: current.t.end, total: current.t.end - current.t.start };
  }
  const next = timed.find((x) => x.t.start > now);
  if (!next) return { kind: "after" };
  const previous = timed.filter((x) => x.t.end <= now).at(-1);
  if (!previous) return { kind: "before", period: next.p, lesson: lessonOf(next.p), endsAt: next.t.start, total: BEFORE_WINDOW_MS };
  return { kind: "break", period: next.p, lesson: lessonOf(next.p), endsAt: next.t.start, total: next.t.start - previous.t.end };
}

export function bellKey(b: Bell): string {
  return "period" in b ? `${b.kind}:${b.period.id}` : b.kind;
}

// 進入上課或離開上課的那一刻響；第一次打開（沒有上一個狀態）不響
export function bellChimes(prev: string | null, next: string): boolean {
  if (prev === null || prev === next) return false;
  return prev.startsWith("class:") || next.startsWith("class:");
}
