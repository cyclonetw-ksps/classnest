import { useEffect, useRef, useState } from "preact/hooks";
import { bellAt, bellChimes, bellKey, type Bell as BellState, type BellLesson } from "../shared/bell";
import { atClock, formatClock, formatRemaining, parseClock, parseMinutes, remainingFraction, remainingMs, TIMER_MAX_MINUTES } from "../shared/clock";
import { chimeDue, pauseRun, restartRun, resumeRun, runView, startRun, type Run } from "../shared/timer";
import type { ClassState, WeekView } from "../shared/types";
import { localDate, mondayOf, weekdayOf } from "../shared/week";
import { request } from "./api";
import { playChime, readMuted, unlockChime, writeMuted } from "./chime";
import { paperAt } from "./palette";
import { Bell, BellOff, Expand, Pause, Play, Restart, Shrink, Stop } from "./icons";

// 大螢幕：投影用的計時畫面。只有計時與組別、科目，不放任何學生資料或分數。
// 兩種模式：計時（自訂分鐘或倒數到時刻），以及依課表（讀本週課表，自動倒數下課與上課，判斷在 src/shared/bell.ts）。
// 計時以結束時刻為準（endAt），每次重畫都用裝置時鐘重新算，背景分頁回來也不會飄。
// 狀態轉移（暫停、繼續、重來、何時響）在 src/shared/timer.ts，有測試。

const PRESETS = [1, 3, 5, 10, 15, 20, 30];
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// 這一節沒有排組別也沒有科目，就是空堂
const isFree = (l: BellLesson | null) => !l || (!l.subject && !l.groupId);

// 依課表模式的標題：這一段是什麼。空堂與停課不寫「上課」，免得和下面的內容矛盾
function bellLabel(b: BellState): string {
  const what = (l: BellLesson | null, during: string) => (l?.cancelled ? "停課" : isFree(l) ? "空堂" : during);
  switch (b.kind) {
    case "class":
      return `${b.period.label}　${what(b.lesson, "上課中")}`;
    case "break":
      return `下課　${b.period.label} ${b.period.start} ${what(b.lesson, "上課")}`;
    case "before":
      return `${b.period.label} ${b.period.start} ${what(b.lesson, "上課")}`;
    case "after":
      return "今天的課都上完了";
    case "weekend":
      return "今天沒有排課";
    case "no-periods":
      return "還沒有設定節次";
  }
}

export function ScreenPanel({ hidden, state }: { hidden: boolean; state: ClassState }) {
  const [mode, setMode] = useState<"timer" | "schedule">("timer");
  const [week, setWeek] = useState<WeekView | null>(null);
  const [weekError, setWeekError] = useState("");
  const lastBell = useRef<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(() => readMuted());
  const [minutes, setMinutes] = useState("");
  const [minutesError, setMinutesError] = useState("");
  const [untilName, setUntilName] = useState("");
  const [untilAt, setUntilAt] = useState("");
  const [untilError, setUntilError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [full, setFull] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const chimedFor = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const { remaining, done, running, frac } = runView(run, now);
  const canFull = typeof document !== "undefined" && !!document.fullscreenEnabled;

  // 依課表：今天是星期幾、這週的課、現在是哪一段
  const scheduling = mode === "schedule";
  const today = localDate(new Date(now));
  const weekday = weekdayOf(today);
  const monday = mondayOf(today);
  const todayLessons = week?.weekStart === monday ? week.lessons.filter((l) => l.date === today) : [];
  const bell = scheduling ? bellAt(now, weekday, state.periods, todayLessons) : null;
  const bellKeyNow = bell ? bellKey(bell) : null;
  const counting = bell && "endsAt" in bell ? bell : null;
  const bellLeft = counting ? remainingMs(counting.endsAt, now) : 0;
  const groupName = (id: string | null) => (id ? (state.groups.find((g) => g.id === id)?.name ?? "") : "");
  const groupHue = (id: string | null) => (id ? paperAt(state.groups.findIndex((g) => g.id === id)).hue : null);

  // 依課表模式讀本週課表：開始時、換週、老師在其他分頁改過資料後，以及每 10 分鐘
  useEffect(() => {
    if (!scheduling || weekday >= 6) return;
    let live = true;
    const load = () =>
      request<WeekView>("GET", `week/${monday}`)
        .then((w) => {
          if (!live) return;
          setWeek(w);
          setWeekError("");
        })
        .catch(() => live && setWeekError("讀不到這週的課表，先只依節次時間倒數。"));
    void load();
    const id = setInterval(load, 10 * 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [scheduling, monday, weekday >= 6, state]);

  // 依課表：進入上課或離開上課的那一刻響（第一次打開不響）
  useEffect(() => {
    const prev = lastBell.current;
    lastBell.current = bellKeyNow;
    if (!bell || !bellKeyNow || !bellChimes(prev, bellKeyNow)) return;
    setAnnounce(bell.kind === "class" ? `上課：${bell.period.label}` : "下課");
    if (!mutedRef.current) playChime();
  }, [bellKeyNow]);

  // 跑的時候每 250 毫秒重畫一次；切回這個分頁時立刻補算
  useEffect(() => {
    if (!scheduling && (!running || done)) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running, done, scheduling]);

  // 時間到：同一次計時只響一次
  useEffect(() => {
    if (!run || !chimeDue(run, now, chimedFor.current)) return;
    chimedFor.current = run.endAt;
    setAnnounce("時間到");
    if (!mutedRef.current) playChime();
  }, [done, run, now]);

  // 計時中（含時間到的畫面）與依課表模式盡量不讓螢幕熄滅；瀏覽器不支援就算了
  const keepAwake = running || scheduling;
  useEffect(() => {
    if (!keepAwake || !("wakeLock" in navigator)) return;
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
  }, [keepAwake]);

  useEffect(() => {
    const onChange = () => setFull(!!stageRef.current && document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function scrollToStage() {
    if (!full) stageRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function startSchedule() {
    unlockChime();
    lastBell.current = null;
    setRun(null);
    setNow(Date.now());
    setMode("schedule");
    setAnnounce("開始依課表倒數");
    scrollToStage();
  }

  function begin(next: Run, said: string) {
    unlockChime();
    const t = Date.now();
    setNow(t);
    setMode("timer");
    setRun(next);
    setAnnounce(said);
    scrollToStage();
  }

  function startMinutes(m: number) {
    setMinutesError("");
    begin(startRun("minutes", `計時 ${m} 分鐘`, m * 60_000, Date.now()), `開始計時 ${m} 分鐘`);
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
    begin(startRun("until", `${name} ${formatClock(time)}`, endAt - t, t), `開始倒數到 ${formatClock(time)}`);
  }

  function pause() {
    if (!run) return;
    const t = Date.now();
    const next = pauseRun(run, t);
    setNow(t);
    if (next === run) return; // 時間剛好到了：照常進入「時間到」
    setRun(next);
    setAnnounce("已暫停");
  }

  // 繼續與重來也是使用者按的，順便重新解鎖音訊（iPad 鎖屏回來後可能被暫停）
  function resume() {
    if (!run) return;
    unlockChime();
    const t = Date.now();
    setNow(t);
    setRun(resumeRun(run, t));
    setAnnounce("繼續計時");
  }

  function restart() {
    if (!run) return;
    unlockChime();
    const t = Date.now();
    setNow(t);
    setRun(restartRun(run, t));
    setAnnounce("重新開始");
  }

  function end() {
    if (scheduling) {
      setMode("timer");
      setAnnounce("已結束依課表倒數");
      return;
    }
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

  const time = formatRemaining(scheduling ? bellLeft : remaining);
  const dialFrac = scheduling ? (counting ? remainingFraction(bellLeft, counting.total) : 1) : frac;
  const idle = scheduling ? !counting : !run;
  const lesson = counting?.lesson ?? null;
  const wedge = counting && lesson && !lesson.cancelled ? groupHue(lesson.groupId) : null;
  // 組別色小方塊永遠跟著組別（停課也一樣），沒有組別就不畫
  const swatch = lesson ? groupHue(lesson.groupId) : null;
  const lessonText = lesson ? [groupName(lesson.groupId), lesson.subject].filter((x, i, a) => x && a.indexOf(x) === i).join("・") : "";
  const stageClass = ["stage", !scheduling && done && "done", !scheduling && run?.paused != null && "paused", idle && "idle", scheduling && "bell"].filter(Boolean).join(" ");
  const label = bell ? bellLabel(bell) : run ? run.label : "還沒開始計時";

  return (
    <section aria-labelledby="screen-title" class="screen" hidden={hidden}>
      <div class="section-head">
        <h2 id="screen-title">大螢幕</h2>
      </div>
      <p class="hint">投影這一頁給全班看剩下的時間。切到其他分頁也不會停。</p>

      <div class="screen-layout">
        <div class="screen-setup">
          <div class="card setup-block">
            <h3>依課表</h3>
            {!state.periods.length ? (
              <p class="meta">
                還沒有節次。先到<a href="#schedule">課表</a>設定每一節的時間。
              </p>
            ) : (
              <p class="meta phrases">
                <span>依節次與這週的課自動倒數，</span>
                <span>並提醒下一節要帶什麼。</span>
              </p>
            )}
            {scheduling ? (
              <p class="bell-on" role="status">
                {state.periods.length ? "正在依課表倒數" : "等你設定好節次就開始"}
              </p>
            ) : (
              <div class="form-actions start">
                <button class="btn primary" type="button" onClick={startSchedule}>
                  依課表自動倒數
                </button>
              </div>
            )}
          </div>

          <form
            class="card setup-block"
            onSubmit={(e) => {
              e.preventDefault();
              const m = parseMinutes(minutes);
              if (m) startMinutes(m);
              else setMinutesError(`請輸入 1 到 ${TIMER_MAX_MINUTES} 的整數，例如 15。`);
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
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={TIMER_MAX_MINUTES}
                  step={1}
                  required
                  value={minutes}
                  onInput={(e) => {
                    setMinutes(e.currentTarget.value);
                    setMinutesError("");
                  }}
                  data-error="sc-min-err"
                  class={`num ${minutesError ? "has-error" : ""}`}
                />
                <span class="unit-label">分鐘</span>
                <button class="btn primary" type="submit">
                  開始
                </button>
                <span class="error-msg" id="sc-min-err">
                  請輸入 1 到 {TIMER_MAX_MINUTES} 的整數。
                </span>
                <span class="field-error" role="alert">
                  {minutesError}
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
            <p class="stage-label">{label}</p>
            <div class="stage-body">
              <div class="dial">
                <progress
                  class="dial-face"
                  max={1}
                  value={dialFrac}
                  aria-label="剩餘時間"
                  aria-valuetext={idle ? "尚未開始" : !scheduling && done ? "時間到" : `剩 ${time}`}
                  style={wedge ? { "--value": String(dialFrac), "--wedge": wedge } : { "--value": String(dialFrac) }}
                />
                <svg class="dial-ticks" viewBox="0 0 100 100" aria-hidden="true">
                  {TICKS.map((deg) => (
                    <line key={deg} x1="50" y1="2.5" x2="50" y2={deg % 90 === 0 ? "9" : "7"} stroke="currentColor" stroke-width="1.3" stroke-linecap="round" transform={`rotate(${deg} 50 50)`} />
                  ))}
                </svg>
              </div>
              {!scheduling && (
                <div class="stage-readout" aria-hidden="true" hidden={!run}>
                  {done ? (
                    <p class="stage-done">時間到</p>
                  ) : (
                    <p class={`stage-time ${time.length > 5 ? "long" : ""}`}>{time}</p>
                  )}
                  {run?.paused != null && <p class="stage-tag">暫停中</p>}
                </div>
              )}
              {scheduling && (
                <div class="stage-readout">
                  {counting && (
                    <p class={`stage-time ${time.length > 5 ? "long" : ""}`} aria-hidden="true">
                      {time}
                    </p>
                  )}
                  {counting && (
                    <div key={bellKeyNow} class="stage-lesson" style={swatch ? { "--paper": swatch } : undefined}>
                      <p class={`stage-lesson-what ${swatch ? "" : "no-group"}`}>
                        {counting.kind !== "class" && <span class="stage-lesson-next">下一節</span>}
                        {lessonText || "空堂"}
                      </p>
                      {lesson?.cancelled && <p class="stage-tag stage-cancel">停課{lesson.note && `・${lesson.note}`}</p>}
                      {counting.kind !== "class" && lesson && !lesson.cancelled && lesson.bring && <p class="stage-lesson-bring">要帶：{lesson.bring}</p>}
                    </div>
                  )}
                  {bell?.kind === "no-periods" && (
                    <a class="btn stage-main" href="#schedule">
                      到課表設定節次
                    </a>
                  )}
                  {(bell?.kind === "after" || bell?.kind === "weekend") && (
                    <p class="stage-note phrases">
                      <span>上課日會依課表自動倒數，</span>
                      <span>這一頁開著就好。</span>
                    </p>
                  )}
                  {weekError && <p class="stage-note">{weekError}</p>}
                </div>
              )}
            </div>
            <div class="stage-bar">
              <div class="stage-group">
              {!scheduling && run?.kind === "minutes" && !done && (
                <button class="btn stage-main" onClick={run.paused === null ? pause : resume}>
                  {run.paused === null ? <Pause /> : <Play />}
                  {run.paused === null ? "暫停" : "繼續"}
                </button>
              )}
              {!scheduling && run?.kind === "minutes" && (
                <button class={`btn ${done ? "stage-main" : ""}`} onClick={restart}>
                  <Restart />
                  重來
                </button>
              )}
              {(scheduling || run) && (
                <button class="btn" onClick={end}>
                  <Stop />
                  {scheduling ? "結束依課表" : "結束"}
                </button>
              )}
              </div>
              <div class="stage-group">
              <button class="btn" aria-pressed={muted} onClick={toggleMute}>
                {muted ? <BellOff /> : <Bell />}
                靜音
              </button>
              {!muted && idle && (
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
