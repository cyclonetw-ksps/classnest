import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { LIMITS, type ClassState, type Lesson, type Period, type Slot, type WeekView } from "../shared/types";
import { addDays, localDate, mondayOf, weekdayOf, WEEKDAY_NAMES, WEEKDAYS } from "../shared/week";
import { ApiError, request } from "./api";
import type { Act } from "./App";
import { Dialog } from "./Dialog";
import { Plus, Swap } from "./icons";
import { paperAt } from "./palette";

// 課表：節次時間、固定週課表、每週計畫（內容、作業、要帶的東西、換課、停課）。
// 寬的時候是一張表（欄是星期、列是節次）；窄的時候選一天，列出那天的各節。

type View = "week" | "fixed" | "periods";

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 週末打開時直接看下一週（週末通常是在備下週的課）
function thisWeek(): string {
  const today = localDate(new Date());
  const monday = mondayOf(today);
  return weekdayOf(today) >= 6 ? addDays(monday, 7) : monday;
}

function todayWeekday(): number {
  const w = weekdayOf(localDate(new Date()));
  return w >= 6 ? 1 : w;
}

export function SchedulePanel({ state, act }: { state: ClassState; act: Act }) {
  const [view, setView] = useState<View>(state.periods.length ? "week" : "periods");

  return (
    <section aria-labelledby="schedule-title" class="schedule">
      <div class="section-head">
        <h2 id="schedule-title">課表</h2>
        <div class="segmented pills" role="radiogroup" aria-label="要看什麼">
          {(
            [
              ["week", "每週計畫"],
              ["fixed", "固定課表"],
              ["periods", "節次時間"],
            ] as const
          ).map(([id, label]) => (
            <label key={id}>
              <input type="radio" name="sc-view" checked={view === id} onChange={() => setView(id)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {view === "periods" && <PeriodsView state={state} act={act} />}
      {view !== "periods" && state.periods.length === 0 && (
        <div class="empty">
          <p>還沒有節次。先到「節次時間」設定每一節幾點上下課。</p>
          <p>
            <button class="btn primary" onClick={() => setView("periods")}>
              設定節次時間
            </button>
          </p>
        </div>
      )}
      {view === "fixed" && state.periods.length > 0 && <FixedView state={state} act={act} />}
      {view === "week" && state.periods.length > 0 && <WeekPlan state={state} act={act} />}
    </section>
  );
}

/* ---------- 共用：課表格子 ---------- */

// 空堂只留一個淡淡的加號，「空堂」兩字給報讀軟體
const Blank = () => (
  <span class="lesson-empty">
    <Plus />
    <span class="visually-hidden">空堂</span>
  </span>
);

function Grid(props: {
  caption: string;
  periods: Period[];
  days: { weekday: number; date?: string }[];
  today?: string;
  cell: (weekday: number, period: Period) => ComponentChildren;
}) {
  const [day, setDay] = useState(todayWeekday);
  const head = (d: { weekday: number; date?: string }) => (
    <>
      {WEEKDAY_NAMES[d.weekday]}
      {d.date && <span class="tt-date">{shortDate(d.date)}</span>}
      {d.date && d.date === props.today && <span class="tt-today">今天</span>}
    </>
  );
  return (
    <div class="tt">
      <div class="tt-wide" role="region" aria-label={props.caption} tabIndex={0}>
        <table class="tt-table">
          <caption class="visually-hidden">{props.caption}</caption>
          <thead>
            <tr>
              <td />
              {props.days.map((d) => (
                <th key={d.weekday} scope="col" class={d.date && d.date === props.today ? "is-today" : undefined}>
                  {head(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.periods.map((p) => (
              <tr key={p.id}>
                <th scope="row">
                  <span class="tt-period">{p.label}</span>
                  <span class="tt-time">
                    {p.start}–{p.end}
                  </span>
                </th>
                {props.days.map((d) => (
                  <td key={d.weekday} class={d.date && d.date === props.today ? "is-today" : undefined}>
                    {props.cell(d.weekday, p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="tt-narrow">
        <div class="segmented pills tt-days" role="radiogroup" aria-label="星期">
          {props.days.map((d) => (
            <label key={d.weekday}>
              <input type="radio" name={`tt-day-${props.caption}`} checked={day === d.weekday} onChange={() => setDay(d.weekday)} />
              {WEEKDAY_NAMES[d.weekday].slice(1)}
            </label>
          ))}
        </div>
        <h3 class="tt-day-title">{head(props.days.find((d) => d.weekday === day) ?? props.days[0])}</h3>
        <ol class="tt-list">
          {props.periods.map((p) => (
            <li key={p.id}>
              <div class="tt-list-head">
                <span class="tt-period">{p.label}</span>
                <span class="tt-time">
                  {p.start}–{p.end}
                </span>
              </div>
              {props.cell(day, p)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function useGroups(state: ClassState) {
  const colorOf = (id: string | null) => (id ? state.groups.findIndex((g) => g.id === id) : -1);
  const nameOf = (id: string | null) => (id ? (state.groups.find((g) => g.id === id)?.name ?? "") : "");
  return { colorOf, nameOf };
}

function GroupSelect(props: { id: string; state: ClassState; value: string | null; onChange: (v: string | null) => void }) {
  const choices = props.state.groups.filter((g) => g.active || g.id === props.value);
  return (
    <select id={props.id} value={props.value ?? ""} onChange={(e) => props.onChange(e.currentTarget.value || null)}>
      <option value="">不指定組別</option>
      {choices.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}

/* ---------- 節次時間 ---------- */

function PeriodsView({ state, act }: { state: ClassState; act: Act }) {
  const [draft, setDraft] = useState<{ label: string; start: string; end: string }>({ label: "", start: "", end: "" });
  const [edit, setEdit] = useState<Period | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const next = `第${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][state.periods.length] ?? ""}節`;

  return (
    <div class="schedule-body">
      <p class="hint">每一節幾點上課、幾點下課；節次不能重疊。</p>
      {state.periods.length < LIMITS.periods && (
        <form
          class="card period-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const label = draft.label.trim() || next;
            if (await act(() => request("POST", "periods", { ...draft, label }), `已新增${label}`)) setDraft({ label: "", start: draft.end, end: "" });
          }}
        >
          <div class="field">
            <label for="p-label">名稱</label>
            <input id="p-label" maxLength={LIMITS.periodLabel} placeholder={next} value={draft.label} onInput={(e) => setDraft({ ...draft, label: e.currentTarget.value })} />
          </div>
          <div class="field">
            <label for="p-start">上課</label>
            <input id="p-start" type="time" required value={draft.start} onInput={(e) => setDraft({ ...draft, start: e.currentTarget.value })} />
          </div>
          <div class="field">
            <label for="p-end">下課</label>
            <input id="p-end" type="time" required value={draft.end} onInput={(e) => setDraft({ ...draft, end: e.currentTarget.value })} />
          </div>
          <button class="btn primary" type="submit">
            <Plus />
            新增一節
          </button>
        </form>
      )}
      {state.periods.length > 0 ? (
        <ul class="rows">
          {state.periods.map((p) => (
            <li key={p.id}>
              <div class="row-main">
                <strong>{p.label}</strong>
                <span class="meta">
                  {p.start}–{p.end}
                </span>
              </div>
              <button class="btn small" onClick={() => (setEdit(p), setConfirmDelete(false))}>
                修改
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="empty">還沒有節次。從第一節開始，填上課與下課時間。</p>
      )}

      <Dialog open={edit !== null} title={edit ? `修改${edit.label}` : ""} onClose={() => setEdit(null)}>
        {edit && !confirmDelete && (
          <form
            class="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(() => request("PATCH", `periods/${edit.id}`, { label: edit.label, start: edit.start, end: edit.end }), `已更新${edit.label}`)) setEdit(null);
            }}
          >
            <div class="field">
              <label for="pe-label">名稱</label>
              <input id="pe-label" required maxLength={LIMITS.periodLabel} pattern=".*\S.*" value={edit.label} onInput={(e) => setEdit({ ...edit, label: e.currentTarget.value })} />
            </div>
            <div class="field-pair">
              <div class="field">
                <label for="pe-start">上課</label>
                <input id="pe-start" type="time" required value={edit.start} onInput={(e) => setEdit({ ...edit, start: e.currentTarget.value })} />
              </div>
              <div class="field">
                <label for="pe-end">下課</label>
                <input id="pe-end" type="time" required value={edit.end} onInput={(e) => setEdit({ ...edit, end: e.currentTarget.value })} />
              </div>
            </div>
            <div class="form-actions spread">
              <button type="button" class="btn quiet" onClick={() => setConfirmDelete(true)}>
                刪除這一節
              </button>
              <button type="submit" class="btn primary">
                儲存
              </button>
            </div>
          </form>
        )}
        {edit && confirmDelete && (
          <div class="form">
            <p>確定刪除「{edit.label}」？固定課表裡這一節的安排會一起清掉；各週已經寫的內容會保留，但不再顯示。</p>
            <div class="form-actions">
              <button type="button" class="btn" onClick={() => setConfirmDelete(false)}>
                不刪了
              </button>
              <button
                type="button"
                class="btn danger"
                onClick={async () => {
                  if (await act(() => request("DELETE", `periods/${edit.id}`), `已刪除${edit.label}`)) setEdit(null);
                }}
              >
                確定刪除
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ---------- 固定課表 ---------- */

function FixedView({ state, act }: { state: ClassState; act: Act }) {
  const { colorOf, nameOf } = useGroups(state);
  const [draft, setDraft] = useState<(Slot & { label: string }) | null>(null);
  const slotAt = (weekday: number, periodId: string) => state.slots.find((s) => s.weekday === weekday && s.periodId === periodId);

  return (
    <div class="schedule-body">
      <p class="hint">每週固定的安排。只有某一週要換課或停課，到「每週計畫」改。</p>
      <Grid
        caption="固定課表"
        periods={state.periods}
        days={WEEKDAYS.map((weekday) => ({ weekday }))}
        cell={(weekday, p) => {
          const s = slotAt(weekday, p.id);
          const label = `${WEEKDAY_NAMES[weekday]}${p.label}`;
          return (
            <button
              class={`lesson ${s ? "" : "blank"}`}
              style={s?.groupId ? { "--paper": paperAt(colorOf(s.groupId)).hue } : undefined}
              onClick={() => setDraft({ weekday, periodId: p.id, groupId: s?.groupId ?? null, subject: s?.subject ?? "", bring: s?.bring ?? "", label })}
            >
              <span class="visually-hidden">{label}：</span>
              {s ? (
                <>
                  <span class="lesson-subject">{s.subject}</span>
                  {s.groupId && nameOf(s.groupId) !== s.subject && <span class="lesson-group">{nameOf(s.groupId)}</span>}
                  {s.bring && <span class="lesson-line">帶：{s.bring}</span>}
                </>
              ) : (
                <Blank />
              )}
              <span class="visually-hidden">（修改）</span>
            </button>
          );
        }}
      />

      <Dialog open={draft !== null} title={draft?.label ?? ""} onClose={() => setDraft(null)}>
        {draft && (
          <form
            class="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const { label, ...slot } = draft;
              if (await act(() => request("PUT", "slots", slot), slot.subject.trim() ? `已排好${label}` : `已清掉${label}`)) setDraft(null);
            }}
          >
            <div class="field">
              <label for="sl-group">組別</label>
              <GroupSelect id="sl-group" state={state} value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} />
            </div>
            <div class="field">
              <label for="sl-subject">科目</label>
              <input id="sl-subject" maxLength={LIMITS.subject} placeholder="例如：國語、數學" value={draft.subject} onInput={(e) => setDraft({ ...draft, subject: e.currentTarget.value })} />
              <span class="meta">科目留空就是空堂。</span>
            </div>
            <div class="field">
              <label for="sl-bring">要帶的東西（每週預設）</label>
              <input id="sl-bring" maxLength={LIMITS.bring} placeholder="例如：國語課本、鉛筆盒" value={draft.bring} onInput={(e) => setDraft({ ...draft, bring: e.currentTarget.value })} />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn primary">
                儲存
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

/* ---------- 每週計畫 ---------- */

type LessonDraft = {
  lesson: Lesson;
  title: string;
  content: string;
  homework: string;
  bring: string;
  changed: boolean;
  groupId: string | null;
  subject: string;
  cancelled: boolean;
  note: string;
};

function WeekPlan({ state, act }: { state: ClassState; act: Act }) {
  const { colorOf, nameOf } = useGroups(state);
  const [monday, setMonday] = useState(thisWeek);
  const [week, setWeek] = useState<WeekView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [copied, setCopied] = useState("");
  const [retry, setRetry] = useState(0);
  const today = localDate(new Date());

  // 換週或老師端資料更新後重新讀這一週
  useEffect(() => {
    let live = true;
    setLoadError("");
    request<WeekView>("GET", `week/${monday}`)
      .then((w) => live && setWeek(w))
      .catch((err) => live && setLoadError(err instanceof ApiError ? err.message : "讀不到這一週，請稍後再試"));
    return () => {
      live = false;
    };
  }, [monday, state, retry]);

  const shown = week?.weekStart === monday ? week : null;
  const periodOf = (id: string) => state.periods.find((p) => p.id === id);
  const lessonAt = (weekday: number, periodId: string) => shown?.lessons.find((l) => l.weekday === weekday && l.periodId === periodId);
  const filled = shown?.lessons.filter((l) => l.content || l.homework || l.ownBring).length ?? 0;

  function open(l: Lesson) {
    const p = periodOf(l.periodId);
    setDraft({
      lesson: l,
      title: `${WEEKDAY_NAMES[l.weekday]} ${shortDate(l.date)} ${p?.label ?? ""}`,
      content: l.content,
      homework: l.homework,
      bring: l.ownBring,
      changed: l.changed,
      groupId: l.groupId,
      subject: l.changed ? l.subject : (l.base?.subject ?? ""),
      cancelled: l.cancelled,
      note: l.note,
    });
  }

  async function save(e: Event) {
    e.preventDefault();
    if (!draft) return;
    const l = draft.lesson;
    const body = {
      weekStart: monday,
      weekday: l.weekday,
      periodId: l.periodId,
      content: draft.content,
      homework: draft.homework,
      bring: draft.bring,
      change: draft.changed ? { groupId: draft.groupId, subject: draft.subject } : null,
      cancelled: draft.cancelled,
      note: draft.cancelled ? draft.note : "",
    };
    if (await act(() => request("PUT", "lessons", body), `已儲存${draft.title}`)) setDraft(null);
  }

  return (
    <div class="schedule-body">
      <div class="week-bar">
        <div class="week-nav">
          <button class="btn small" onClick={() => setMonday(addDays(monday, -7))}>
            上一週
          </button>
          <h3 class="week-range" aria-live="polite">
            {shortDate(monday)} – {shortDate(addDays(monday, 4))}
          </h3>
          <button class="btn small" onClick={() => setMonday(addDays(monday, 7))}>
            下一週
          </button>
        </div>
        <div class="copy">
          {monday !== thisWeek() && (
            <button class="btn small" onClick={() => setMonday(thisWeek())}>
              回到本週
            </button>
          )}
          <button
            class="btn small"
            onClick={async () => {
              let n = 0;
              const done = await act(async () => {
                n = (await request<{ copied: number }>("POST", `week/${monday}/copy-last`)).copied;
              });
              if (done) setCopied(n ? `複製了 ${n} 節上週的內容` : "上週沒有內容可以複製到這週的空格");
            }}
          >
            複製上週
          </button>
          <span class="copy-tip" role="status">
            {copied}
          </span>
        </div>
      </div>
      <p class="hint">點一格寫這週的內容、作業、要帶的東西，或換課、停課。</p>
      {loadError && (
        <p class="notice error">
          {loadError}
          <button class="btn ghost small" onClick={() => setRetry(retry + 1)}>
            再試一次
          </button>
        </p>
      )}
      {!shown && !loadError && <p class="muted">載入中…</p>}
      {shown && (
        <>
          <Grid
            caption={`${shortDate(monday)} 這一週的課`}
            periods={shown.periods}
            days={shown.days}
            today={today}
            cell={(weekday, p) => {
              const l = lessonAt(weekday, p.id);
              if (!l) return null;
              const label = `${WEEKDAY_NAMES[weekday]}${p.label}`;
              return (
                <button
                  class={`lesson ${l.cancelled ? "cancelled" : ""} ${!l.subject && !l.content && !l.homework && !l.bring ? "blank" : ""}`}
                  style={l.groupId ? { "--paper": paperAt(colorOf(l.groupId)).hue } : undefined}
                  onClick={() => open(l)}
                >
                  <span class="visually-hidden">{label}：</span>
                  {(l.cancelled || l.changed) && (
                    <span class="lesson-tags">
                      {l.cancelled && <span class="tag tag-cancel">停課{l.note && `・${l.note}`}</span>}
                      {l.changed && (
                        <span class="tag tag-change">
                          <Swap />
                          換課
                        </span>
                      )}
                    </span>
                  )}
                  {l.subject ? <span class="lesson-subject">{l.subject}</span> : !l.content && !l.homework && !l.bring && <Blank />}
                  {l.groupId && nameOf(l.groupId) !== l.subject && <span class="lesson-group">{nameOf(l.groupId)}</span>}
                  {/* 停課的課不顯示內容、作業與要帶的東西，免得學生替停掉的課準備 */}
                  {!l.cancelled && l.content && <span class="lesson-line lesson-content">{l.content}</span>}
                  {!l.cancelled && l.homework && (
                    <span class="lesson-line lesson-hw">
                      <span class="due">作業</span> {l.homework}
                    </span>
                  )}
                  {!l.cancelled && l.bring && <span class="lesson-line">帶：{l.bring}</span>}
                  <span class="visually-hidden">（編輯）</span>
                </button>
              );
            }}
          />
          {filled === 0 && <p class="hint">這週還沒有寫任何內容。可以先按「複製上週」，或讓 agent 用 MCP 一次填好整週。</p>}
        </>
      )}

      <Dialog open={draft !== null} title={draft?.title ?? ""} onClose={() => setDraft(null)} wide>
        {draft && (
          <form class="form" onSubmit={save}>
            <p class="lesson-base">
              {draft.lesson.base ? (
                <>
                  固定課表：{[nameOf(draft.lesson.base.groupId), draft.lesson.base.subject].filter(Boolean).join(" ")}
                  {draft.lesson.base.bring && `（帶：${draft.lesson.base.bring}）`}
                </>
              ) : (
                "固定課表：空堂"
              )}
            </p>
            <div class="field">
              <label for="ls-content">教學內容</label>
              <textarea id="ls-content" maxLength={LIMITS.lessonContent} rows={3} value={draft.content} onInput={(e) => setDraft({ ...draft, content: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label for="ls-homework">作業</label>
              <textarea id="ls-homework" maxLength={LIMITS.homework} rows={2} value={draft.homework} onInput={(e) => setDraft({ ...draft, homework: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label for="ls-bring">這週要帶的東西</label>
              <input
                id="ls-bring"
                maxLength={LIMITS.bring}
                placeholder={draft.lesson.base?.bring ? `不填就用預設：${draft.lesson.base.bring}` : "例如：直笛、彩色筆"}
                value={draft.bring}
                onInput={(e) => setDraft({ ...draft, bring: e.currentTarget.value })}
              />
            </div>
            <fieldset class="field lesson-adjust">
              <legend>只有這一週</legend>
              <label class="check">
                <input type="checkbox" checked={draft.changed} onChange={(e) => setDraft({ ...draft, changed: e.currentTarget.checked })} />
                換課
              </label>
              {draft.changed && (
                <div class="field-pair">
                  <div class="field">
                    <label for="ls-group">換成哪一組</label>
                    <GroupSelect id="ls-group" state={state} value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} />
                  </div>
                  <div class="field">
                    <label for="ls-subject">換成什麼科</label>
                    <input id="ls-subject" required maxLength={LIMITS.subject} pattern=".*\S.*" value={draft.subject} onInput={(e) => setDraft({ ...draft, subject: e.currentTarget.value })} data-error="ls-subject-err" />
                    <span class="error-msg" id="ls-subject-err">
                      請填寫科目。
                    </span>
                  </div>
                </div>
              )}
              <label class="check">
                <input type="checkbox" checked={draft.cancelled} onChange={(e) => setDraft({ ...draft, cancelled: e.currentTarget.checked })} />
                停課
              </label>
              {draft.cancelled && (
                <div class="field">
                  <label for="ls-note">原因（可不填）</label>
                  <input id="ls-note" maxLength={LIMITS.lessonNote} placeholder="例如：校外教學" value={draft.note} onInput={(e) => setDraft({ ...draft, note: e.currentTarget.value })} />
                </div>
              )}
            </fieldset>
            {draft.lesson.updatedBy && (
              <p class="meta">
                最後由 {draft.lesson.updatedBy} 修改
              </p>
            )}
            <div class="form-actions sticky-actions">
              <button type="submit" class="btn primary">
                儲存
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
