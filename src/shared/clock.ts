// 大螢幕計時用的純函式。時間一律以「結束時刻」為準，用裝置時鐘算剩餘時間，
// 不靠累加 setInterval，背景分頁回來也不會飄。切片 6b（依課表倒數）也用這裡。

export const TIMER_MAX_MINUTES = 180;

export interface ClockTime {
  h: number;
  m: number;
}

// 「HH:MM」或「H:MM」，冒號可以是全形；數字只收半形
export function parseClock(text: string): ClockTime | null {
  const match = /^(\d{1,2})[:：](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

// 1 到上限的整數分鐘
export function parseMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= TIMER_MAX_MINUTES ? n : null;
}

// 裝置當地時間「今天」的那個時刻（毫秒）。已經過了也照樣回傳，由呼叫端決定要不要開始
export function atClock(now: number, time: ClockTime): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.h, time.m, 0, 0).getTime();
}

export function remainingMs(endAt: number, now: number): number {
  return Math.max(0, endAt - now);
}

// 剩餘比例，夾在 0 到 1；總長為 0 時當作已結束
export function remainingFraction(remaining: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, remaining / total));
}

// 秒數無條件進位：開始時顯示完整分鐘，最後一秒才變 00:00
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatClock(time: ClockTime): string {
  return `${String(time.h).padStart(2, "0")}:${String(time.m).padStart(2, "0")}`;
}
