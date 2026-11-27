import { useEffect, useState } from "preact/hooks";
import { diaryText } from "../shared/diary";
import { LIMITS, type ClassState, type DiaryDay, type DiaryEntry } from "../shared/types";
import { addDays, localDate, weekdayOf, WEEKDAY_NAMES } from "../shared/week";
import { ApiError, request } from "./api";
import type { Act } from "./App";
import { CopyButton } from "./copy";
import { DiaryLines } from "./diary-lines";
import { Dialog } from "./Dialog";
import { Check } from "./icons";
import { paperAt } from "./palette";

// 聯絡簿：一天一組一則。打開還沒寫的那一則時，先帶入當天課表這一組的作業與要帶的東西；
// 存草稿只有老師看得到，按「發送」家長才從分享頁看得到。個別加註只出現在老師端與「複製給這位學生」的文字。

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 上課日才寫聯絡簿：往前或往後跳過週末
function schoolDay(date: string, step: 1 | -1): string {
  let d = addDays(date, step);
  while (weekdayOf(d) >= 6) d = addDays(d, step);
  return d;
}

// 週末打開時直接看下週一（和課表一樣：週末通常是在準備下週）
function defaultDay(): string {
  const today = localDate(new Date());
  return weekdayOf(today) >= 6 ? schoolDay(today, 1) : today;
}

const clock = (t: number) => new Date(t).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });

type Draft = {
  entry: DiaryEntry;
  homework: string;
  bring: string;
  note: string;
  notes: Record<string, string>;
  // 這次打開時是從課表帶入的
  fromSchedule: boolean;
};

export function DiaryPanel({ state, act }: { state: ClassState; act: Act }) {
  const [date, setDate] = useState(defaultDay);
  const [day, setDay] = useState<DiaryDay | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = localDate(new Date());

  useEffect(() => {
    let live = true;
    setLoadError("");
    request<DiaryDay>("GET", `diary/${date}`)
      .then((d) => live && setDay(d))
      .catch((err) => live && setLoadError(err instanceof ApiError ? err.message : "讀不到這一天的聯絡簿，請稍後再試"));
    return () => {
      live = false;
    };
  }, [date, state, retry]);

  const shown = day?.date === date ? day : null;
  const groupIndex = (id: string) => state.groups.findIndex((g) => g.id === id);
  const groupName = (id: string) => state.groups.find((g) => g.id === id)?.name ?? "";
  const members = (groupId: string) => state.students.filter((s) => s.active && s.groupIds.includes(groupId));
  const studentName = (id: string) => state.students.find((s) => s.id === id)?.displayName ?? "";

  function open(e: DiaryEntry) {
    const fresh = e.status === "empty";
    const fromSchedule = fresh && !!(e.suggested.homework || e.suggested.bring);
    setDraft({
      entry: e,
      homework: fresh ? e.suggested.homework : e.homework,
      bring: fresh ? e.suggested.bring : e.bring,
      note: e.note,
      notes: Object.fromEntries(e.studentNotes.map((n) => [n.studentId, n.text])),
      fromSchedule,
    });
  }

  async function save(status: "draft" | "sent") {
    if (!draft) return;
    const e = draft.entry;
    const ids = new Set([...members(e.groupId).map((s) => s.id), ...e.studentNotes.map((n) => n.studentId)]);
    const body = {
      date: e.date,
      groupId: e.groupId,
      homework: draft.homework,
      bring: draft.bring,
      note: draft.note,
      status,
      studentNotes: [...ids].map((studentId) => ({ studentId, text: draft.notes[studentId] ?? "" })),
    };
    const name = groupName(e.groupId);
    const done = status === "sent" ? (e.status === "sent" ? `已更新${name}的聯絡簿` : `已發送${name}的聯絡簿`) : `已存成${name}的草稿`;
    if (await act(() => request("PUT", "diary", body), done)) setDraft(null);
  }

  async function sendAsIs(e: DiaryEntry) {
    const body = { date: e.date, groupId: e.groupId, homework: e.homework, bring: e.bring, note: e.note, status: "sent" };
    await act(() => request("PUT", "diary", body), `已發送${groupName(e.groupId)}的聯絡簿`);
  }

  const draftEmpty = draft ? !draft.homework.trim() && !draft.bring.trim() && !draft.note.trim() : true;

  return (
    <section aria-labelledby="diary-title" class="diary">
      <div class="section-head">
        <h2 id="diary-title">聯絡簿</h2>
      </div>
      <div class="week-bar">
        <div class="week-nav">
          <button class="btn small" onClick={() => setDate(schoolDay(date, -1))}>
            前一天
          </button>
          <h3 class="week-range" aria-live="polite">
            {WEEKDAY_NAMES[weekdayOf(date)] ?? ""} {shortDate(date)}
            {date === today && <span class="tt-today">今天</span>}
          </h3>
          <button class="btn small" onClick={() => setDate(schoolDay(date, 1))}>
            後一天
          </button>
        </div>
        {date !== defaultDay() && (
          <button class="btn small" onClick={() => setDate(defaultDay())}>
            回到今天
          </button>
        )}
      </div>
      <p class="hint">一天一組一則。存草稿只有老師看得到；按「發送」後家長從分享頁看得到，也可以複製貼到 LINE。</p>

      {state.groups.every((g) => !g.active) && <p class="empty">還沒有組別。先到「組別」建立，聯絡簿會替每一組各準備一則。</p>}
      {loadError && (
        <p class="notice error">
          {loadError}
          <button class="btn ghost small" onClick={() => setRetry(retry + 1)}>
            再試一次
          </button>
        </p>
      )}
      {!shown && !loadError && <p class="muted">載入中…</p>}
      {shown && shown.entries.length > 0 && (
        <ol class="diary-list">
          {shown.entries.map((e) => {
            const name = groupName(e.groupId);
            const p = paperAt(groupIndex(e.groupId));
            const hasContent = !!(e.homework || e.bring || e.note);
            return (
              <li key={e.groupId} class={`diary-entry is-${e.status}`} style={{ "--paper": p.hue }}>
                <div class="diary-head">
                  <h3>{name}</h3>
                  {e.status === "sent" && (
                    <span class="tag tag-sent">
                      <Check />
                      已發送 {e.sentAt ? clock(e.sentAt) : ""}
                    </span>
                  )}
                  {e.status === "draft" && <span class="tag tag-draft">草稿</span>}
                </div>
                {e.status === "empty" ? (
                  e.suggested.homework || e.suggested.bring ? (
                    <div class="diary-suggest">
                      <p class="diary-suggest-title">課表上今天這一組有：</p>
                      <DiaryLines homework={e.suggested.homework} bring={e.suggested.bring} note="" />
                    </div>
                  ) : (
                    <p class="diary-blank">還沒寫</p>
                  )
                ) : (
                  <DiaryLines homework={e.homework} bring={e.bring} note={e.note} />
                )}
                {(e.studentNotes.length > 0 || (e.status === "draft" && e.updatedBy.startsWith("agent："))) && (
                  <p class="diary-meta">
                    {e.studentNotes.length > 0 && <span>個別加註 {e.studentNotes.length} 位</span>}
                    {e.status === "draft" && e.updatedBy.startsWith("agent：") && <span>{e.updatedBy.slice("agent：".length)} 草擬</span>}
                  </p>
                )}
                <div class="diary-actions">
                  <button class={`btn small ${e.status === "empty" ? "primary" : ""}`} onClick={() => open(e)}>
                    {e.status === "empty" ? "寫聯絡簿" : "修改"}
                  </button>
                  {e.status === "draft" && hasContent && (
                    <button class="btn small primary" onClick={() => sendAsIs(e)}>
                      發送
                    </button>
                  )}
                  {e.status === "sent" && <CopyButton text={diaryText(e, name)} label={`複製${name}的聯絡簿`}>複製文字</CopyButton>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={draft !== null} title={draft ? `${groupName(draft.entry.groupId)}・${WEEKDAY_NAMES[weekdayOf(draft.entry.date)] ?? ""} ${shortDate(draft.entry.date)}` : ""} onClose={() => setDraft(null)} wide>
        {draft && (
          <form
            class="form"
            onSubmit={(ev) => {
              ev.preventDefault();
              void save("sent");
            }}
          >
            {draft.fromSchedule && <p class="lesson-base">已從當天課表帶入作業與要帶的東西，可以直接修改。</p>}
            {!draft.fromSchedule &&
              (draft.entry.suggested.homework || draft.entry.suggested.bring) &&
              (draft.homework !== draft.entry.suggested.homework || draft.bring !== draft.entry.suggested.bring) && (
              <p class="diary-refill">
                <span class="meta muted">課表上這天也有作業或要帶的東西。</span>
                <button
                  type="button"
                  class="btn small"
                  onClick={() => setDraft({ ...draft, homework: draft.entry.suggested.homework, bring: draft.entry.suggested.bring })}
                >
                  重新從課表帶入
                </button>
              </p>
            )}
            <div class="field">
              <label for="dy-homework">作業</label>
              <textarea id="dy-homework" class="grow" maxLength={LIMITS.diaryHomework} rows={2} value={draft.homework} onInput={(ev) => setDraft({ ...draft, homework: ev.currentTarget.value })} />
            </div>
            <div class="field">
              <label for="dy-bring">要帶的東西</label>
              <input id="dy-bring" maxLength={LIMITS.diaryBring} placeholder="例如：國語課本、直笛" value={draft.bring} onInput={(ev) => setDraft({ ...draft, bring: ev.currentTarget.value })} />
            </div>
            <div class="field">
              <label for="dy-note">備註</label>
              <textarea
                id="dy-note"
                class="grow"
                maxLength={LIMITS.diaryNote}
                rows={2}
                placeholder="例如：明天戶外教學，請穿運動服"
                value={draft.note}
                onInput={(ev) => setDraft({ ...draft, note: ev.currentTarget.value })}
              />
            </div>
            <fieldset class="field lesson-adjust">
              <legend>個別加註</legend>
              <p class="meta muted">只有老師看得到，不會出現在分享頁；複製給這位學生時才會帶上。</p>
              {members(draft.entry.groupId).length === 0 && draft.entry.studentNotes.length === 0 ? (
                <p class="muted">這一組還沒有學生。</p>
              ) : (
                <ul class="diary-notes">
                  {[...new Set([...members(draft.entry.groupId).map((s) => s.id), ...draft.entry.studentNotes.map((n) => n.studentId)])].map((id) => {
                    const name = studentName(id);
                    const value = draft.notes[id] ?? "";
                    return (
                      <li key={id}>
                        <label for={`dy-n-${id}`}>{name}</label>
                        <input
                          id={`dy-n-${id}`}
                          maxLength={LIMITS.studentNote}
                          value={value}
                          onInput={(ev) => setDraft({ ...draft, notes: { ...draft.notes, [id]: ev.currentTarget.value } })}
                        />
                        {draft.entry.status === "sent" && value.trim() && (
                          <CopyButton text={diaryText(draft.entry, groupName(draft.entry.groupId), { name, text: value })} label={`複製給${name}的聯絡簿`} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
            {draft.entry.updatedBy && (
              <p class="meta">
                最後由 {draft.entry.updatedBy.startsWith("agent：") ? draft.entry.updatedBy : (state.teachers.find((t) => t.email === draft.entry.updatedBy)?.name ?? draft.entry.updatedBy)} 修改
              </p>
            )}
            <div class="form-actions sticky-actions spread">
              {draft.entry.status === "sent" ? (
                <button type="button" class="btn quiet" onClick={() => save("draft")}>
                  收回成草稿
                </button>
              ) : (
                <button type="button" class="btn" onClick={() => save("draft")}>
                  存草稿
                </button>
              )}
              <span class="diary-send">
                {draftEmpty && (
                  <span class="meta muted" id="dy-send-why">
                    寫了作業、要帶或備註才能發送
                  </span>
                )}
                <button type="submit" class="btn primary" disabled={draftEmpty} aria-describedby={draftEmpty ? "dy-send-why" : undefined}>
                  {draft.entry.status === "sent" ? "更新" : "發送"}
                </button>
              </span>
            </div>
          </form>
        )}
      </Dialog>
    </section>
  );
}
