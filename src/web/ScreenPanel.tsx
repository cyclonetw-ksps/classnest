import { useEffect, useRef, useState } from "preact/hooks";
import { atClock, formatClock, formatRemaining, parseClock, parseMinutes, remainingFraction, remainingMs, TIMER_MAX_MINUTES } from "../shared/clock";
import { playChime, readMuted, unlockChime, writeMuted } from "./chime";
import { Bell, BellOff, Expand, Pause, Play, Restart, Shrink, Stop } from "./icons";

// 大螢幕：投影用的計時畫面。只有計時，不放任何學生資料或分數。
// 計時以結束時刻為準（endAt），每次重畫都用裝置時鐘重新算，背景分頁回來也不會飄。

interface Run {
  kind: "minutes" | "until";
  label: string;
  total: number;
  endAt: number;
  // 暫停時記下剩餘毫秒；null 代表正在跑
  paused: number | null;
}

const PRESETS = [1, 3, 5, 10, 15, 20, 30];
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ScreenPanel({ hidden }: { hidden: boolean }) {
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(readMuted);
  const [minutes, setMinutes] = useState("");
  const [untilName, setUntilName] = useState("");
  const [untilAt, setUntilAt] = useState("");
  const [untilError, setUntilError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [full, setFull] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const chimedFor = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const running = !!run && run.paused === null;
  const remaining = run ? (run.paused ?? remainingMs(run.endAt, now)) : 0;
  const done = running && remaining === 0;
  const frac = run ? remainingFraction(remaining, run.total) : 1;
  const canFull = typeof document !== "undefined" && !!document.fullscreenEnabled;

  // 跑的時候每 250 毫秒重畫一次；切回這個分頁時立刻補算
  useEffect(() => {
    if (!running || done) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running, done]);

  // 時間到：同一次計時只響一次
  useEffect(() => {
    if (!done || !run || chimedFor.current === run.endAt) return;
    chimedFor.current = run.endAt;
    setAnnounce("時間到");
    if (!mutedRef.current) playChime();
  }, [done, run]);

  // 計時中（含時間到的畫面）盡量不讓螢幕熄滅；瀏覽器不支援就算了
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) void next.release();
        else lock = next;
      } catch {
        // 省電模式或瀏覽器拒絕時不影響計時
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [running]);

  useEffect(() => {
    const onChange = () => setFull(!!stageRef.current && document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function begin(next: Run, said: string) {
    unlockChime();
    const t = Date.now();
    setNow(t);
    setRun(next);
    setAnnounce(said);
    if (!full) stageRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function startMinutes(m: number) {
    const total = m * 60_000;
    begin({ kind: "minutes", label: `計時 ${m} 分鐘`, total, endAt: Date.now() + total, paused: null }, `開始計時 ${m} 分鐘`);
  }

  function startUntil() {
    const time = parseClock(untilAt);
    if (!time) {
      setUntilError("請選一個時刻，例如 10:30。");
      return;
    }
    const t = Date.now();
    const endAt = atClock(t, time);
    if (endAt <= t) {
      setUntilError(`${formatClock(time)} 已經過了，請選還沒到的時刻。`);
      return;
    }
    setUntilError("");
    const name = untilName.trim() || "倒數到";
    begin({ kind: "until", label: `${name} ${formatClock(time)}`, total: endAt - t, endAt, paused: null }, `開始倒數到 ${formatClock(time)}`);
  }

  function pause() {
    if (!run || run.paused !== null) return;
    setRun({ ...run, paused: remainingMs(run.endAt, Date.now()) });
    setAnnounce("已暫停");
  }

  function resume() {
    if (!run || run.paused === null) return;
    const t = Date.now();
    setNow(t);
    setRun({ ...run, endAt: t + run.paused, paused: null });
    setAnnounce("繼續計時");
  }

  function restart() {
    if (!run) return;
    const t = Date.now();
    setNow(t);
    setRun({ ...run, endAt: t + run.total, paused: null });
    setAnnounce("重新開始");
  }

  function end() {
    setRun(null);
    setAnnounce("已結束計時");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    writeMuted(next);
  }

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      // 使用者或瀏覽器拒絕時維持原狀
    }
  }

  const time = formatRemaining(remaining);
  const stageClass = ["stage", done && "done", run?.paused != null && "paused", !run && "idle"].filter(Boolean).join(" ");

  return (
    <section aria-labelledby="screen-title" class="screen" hidden={hidden}>
      <div class="section-head">
        <h2 id="screen-title">大螢幕</h2>
      </div>
      <p class="hint">投影這一頁給全班看剩下的時間。切到其他分頁也不會停。</p>

      <div class="screen-layout">
        <div class="screen-setup">
          <form
            class="card setup-block"
            onSubmit={(e) => {
              e.preventDefault();
              const m = parseMinutes(minutes);
              if (m) startMinutes(m);
            }}
          >
            <h3>計時</h3>
            <div class="presets" role="group" aria-label="常用分鐘">
              {PRESETS.map((m) => (
                <button key={m} type="button" class="preset" onClick={() => startMinutes(m)} aria-label={`計時 ${m} 分鐘`}>
                  <b>{m}</b> 分
                </button>
              ))}
            </div>
            <div class="field">
              <label for="sc-min">自訂分鐘</label>
              <div class="inline-form">
                <input
                  id="sc-min"
                  class="num"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={TIMER_MAX_MINUTES}
                  step={1}
                  required
                  value={minutes}
                  onInput={(e) => setMinutes(e.currentTarget.value)}
                  data-error="sc-min-err"
                />
                <span class="unit-label">分鐘</span>
                <button class="btn primary" type="submit">
                  開始
                </button>
                <span class="error-msg" id="sc-min-err">
                  請輸入 1 到 {TIMER_MAX_MINUTES} 的整數。
                </span>
              </div>
            </div>
          </form>

          <form
            class="card setup-block"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              startUntil();
            }}
          >
            <h3>倒數到時刻</h3>
            <div class="field">
              <label for="sc-name">要倒數什麼（可不填）</label>
              <input id="sc-name" maxLength={10} placeholder="例如：下課" value={untilName} onInput={(e) => setUntilName(e.currentTarget.value)} />
            </div>
            <div class="field">
              <label for="sc-at">時刻</label>
              <input
                id="sc-at"
                type="time"
                value={untilAt}
                class={untilError ? "has-error" : undefined}
                aria-describedby={untilError ? "sc-at-err" : undefined}
                onInput={(e) => {
                  setUntilAt(e.currentTarget.value);
                  setUntilError("");
                }}
              />
              <span class="field-error" id="sc-at-err" role="alert">
                {untilError}
              </span>
            </div>
            <div class="form-actions start">
              <button class="btn primary" type="submit">
                開始倒數
              </button>
            </div>
          </form>
        </div>

        <div class={stageClass} ref={stageRef}>
          <div class="stage-inner">
            <p class="stage-label">{run ? run.label : "還沒開始計時"}</p>
            <div class="stage-body">
              <div class="dial">
                <progress
                  class="dial-face"
                  max={1}
                  value={frac}
                  aria-label="剩餘時間"
                  aria-valuetext={done ? "時間到" : `剩 ${time}`}
                  style={{ "--value": String(frac) }}
                />
                <svg class="dial-ticks" viewBox="0 0 100 100" aria-hidden="true">
                  {TICKS.map((deg) => (
                    <line key={deg} x1="50" y1="2.5" x2="50" y2={deg % 90 === 0 ? "9" : "7"} stroke="currentColor" stroke-width="1.3" stroke-linecap="round" transform={`rotate(${deg} 50 50)`} />
                  ))}
                </svg>
              </div>
              <div class="stage-readout" aria-hidden="true" hidden={!run}>
                {done ? (
                  <p class="stage-done">時間到</p>
                ) : (
                  <p class={`stage-time ${time.length > 5 ? "long" : ""}`}>{time}</p>
                )}
                {run?.paused != null && <p class="stage-tag">暫停中</p>}
              </div>
            </div>
            <div class="stage-bar">
              <div class="stage-group">
              {run?.kind === "minutes" && !done && (
                <button class="btn stage-main" onClick={run.paused === null ? pause : resume}>
                  {run.paused === null ? <Pause /> : <Play />}
                  {run.paused === null ? "暫停" : "繼續"}
                </button>
              )}
              {run?.kind === "minutes" && (
                <button class={`btn ${done ? "stage-main" : ""}`} onClick={restart}>
                  <Restart />
                  重來
                </button>
              )}
              {run && (
                <button class="btn" onClick={end}>
                  <Stop />
                  結束
                </button>
              )}
              </div>
              <div class="stage-group">
              <button class="btn" aria-pressed={muted} onClick={toggleMute}>
                {muted ? <BellOff /> : <Bell />}
                靜音
              </button>
              {!muted && !run && (
                <button
                  class="btn"
                  onClick={() => {
                    playChime();
                  }}
                >
                  試聽
                </button>
              )}
              {canFull && (
                <button class="btn" onClick={toggleFull}>
                  {full ? <Shrink /> : <Expand />}
                  {full ? "離開全螢幕" : "全螢幕"}
                </button>
              )}
              </div>
            </div>
          </div>
          <p class="visually-hidden" role="status">
            {announce}
          </p>
        </div>
      </div>
    </section>
  );
}
