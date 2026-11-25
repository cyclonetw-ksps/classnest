// 大螢幕計時的狀態轉移（純函式，畫面與 6b 共用）。剩餘時間一律由結束時刻 endAt 與「現在」算出。
import { remainingFraction, remainingMs } from "./clock";

export interface Run {
  kind: "minutes" | "until";
  label: string;
  total: number;
  endAt: number;
  // 暫停時記下剩餘毫秒；null 代表正在跑
  paused: number | null;
}

export interface RunView {
  remaining: number;
  done: boolean;
  running: boolean;
  frac: number;
}

export function startRun(kind: Run["kind"], label: string, total: number, now: number): Run {
  return { kind, label, total, endAt: now + total, paused: null };
}

export function runView(run: Run | null, now: number): RunView {
  if (!run) return { remaining: 0, done: false, running: false, frac: 1 };
  const running = run.paused === null;
  const remaining = run.paused ?? remainingMs(run.endAt, now);
  return { remaining, done: running && remaining === 0, running, frac: remainingFraction(remaining, run.total) };
}

// 時間已經到了才按暫停時維持原狀，讓「時間到」照常發生，不會卡在 00:00 暫停中
export function pauseRun(run: Run, now: number): Run {
  if (run.paused !== null) return run;
  const left = remainingMs(run.endAt, now);
  return left === 0 ? run : { ...run, paused: left };
}

export function resumeRun(run: Run, now: number): Run {
  return run.paused === null ? run : { ...run, endAt: now + run.paused, paused: null };
}

export function restartRun(run: Run, now: number): Run {
  return { ...run, endAt: now + run.total, paused: null };
}

// 同一次計時（同一個 endAt）只響一次
export function chimeDue(run: Run | null, now: number, chimedFor: number | null): boolean {
  return !!run && runView(run, now).done && chimedFor !== run.endAt;
}
