import { describe, expect, it } from "vitest";
import { chimeDue, pauseRun, restartRun, resumeRun, runView, startRun } from "../src/shared/timer";
import { readMuted, writeMuted } from "../src/web/chime";

const T0 = 1_000_000;
const MIN = 60_000;

describe("計時狀態", () => {
  it("開始後以結束時刻計算剩餘時間與比例", () => {
    const run = startRun("minutes", "計時 10 分鐘", 10 * MIN, T0);
    expect(run.endAt).toBe(T0 + 10 * MIN);
    expect(runView(run, T0 + 4 * MIN)).toMatchObject({ remaining: 6 * MIN, done: false, running: true, frac: 0.6 });
  });

  it("沒有計時時是閒置、滿格、沒結束", () => {
    expect(runView(null, T0)).toEqual({ remaining: 0, done: false, running: false, frac: 1 });
  });

  it("暫停記下剩餘時間，暫停中時間不會少；繼續後從剩下的接著算", () => {
    const run = startRun("minutes", "x", 10 * MIN, T0);
    const paused = pauseRun(run, T0 + 3 * MIN);
    expect(paused.paused).toBe(7 * MIN);
    expect(runView(paused, T0 + 60 * MIN)).toMatchObject({ remaining: 7 * MIN, running: false, done: false });
    const resumed = resumeRun(paused, T0 + 20 * MIN);
    expect(resumed.paused).toBeNull();
    expect(resumed.endAt).toBe(T0 + 27 * MIN);
  });

  it("重來從完整長度重新開始（暫停中或時間到都可以）", () => {
    const run = startRun("minutes", "x", 5 * MIN, T0);
    const again = restartRun(pauseRun(run, T0 + MIN), T0 + 9 * MIN);
    expect(again).toMatchObject({ endAt: T0 + 14 * MIN, paused: null });
  });

  it("時間已經到了才按暫停：不會卡在 00:00 暫停中，照常進入時間到", () => {
    const run = startRun("minutes", "x", MIN, T0);
    const late = pauseRun(run, T0 + MIN + 100);
    expect(late).toBe(run);
    expect(runView(late, T0 + MIN + 100).done).toBe(true);
  });

  it("繼續與重來只對該狀態有作用", () => {
    const run = startRun("minutes", "x", MIN, T0);
    expect(resumeRun(run, T0 + 10)).toBe(run);
  });
});

describe("提示音只響一次", () => {
  it("時間到且這次計時還沒響過才響；重來後可以再響", () => {
    const run = startRun("minutes", "x", MIN, T0);
    expect(chimeDue(run, T0 + 30_000, null)).toBe(false);
    expect(chimeDue(run, T0 + MIN, null)).toBe(true);
    expect(chimeDue(run, T0 + MIN + 5_000, run.endAt)).toBe(false);
    const again = restartRun(run, T0 + 2 * MIN);
    expect(chimeDue(again, T0 + 3 * MIN, run.endAt)).toBe(true);
  });

  it("暫停中不會響", () => {
    const run = pauseRun(startRun("minutes", "x", MIN, T0), T0 + 1_000);
    expect(chimeDue(run, T0 + 10 * MIN, null)).toBe(false);
  });
});

describe("靜音記在這台裝置", () => {
  function fakeStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  }

  it("寫入後讀得回來，取消後清掉", () => {
    const s = fakeStorage();
    expect(readMuted(s)).toBe(false);
    writeMuted(true, s);
    expect(readMuted(s)).toBe(true);
    writeMuted(false, s);
    expect(readMuted(s)).toBe(false);
  });

  it("儲存空間不能用時當作沒靜音，也不會丟錯", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readMuted(broken)).toBe(false);
    expect(() => writeMuted(true, broken)).not.toThrow();
  });
});
