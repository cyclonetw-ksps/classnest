import { useState } from "preact/hooks";
import { LIMITS, type ClassState, type Group, type LoginCards, type Student } from "../shared/types";
import { ApiError, request } from "./api";
import type { Act } from "./App";
import { cardName, CardPicture } from "./cards";
import { Dialog } from "./Dialog";
import { paperAt } from "./palette";

type Draft = { id?: string; displayName: string; homeClass: string; homeroomTeacher: string; groupIds: string[] };
const empty: Draft = { displayName: "", homeClass: "", homeroomTeacher: "", groupIds: [] };

export function StudentsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cards, setCards] = useState<{ student: Student; cards: number[] | null; confirm: boolean; error: string } | null>(null);
  const groupName = (id: string) => state.groups.find((g) => g.id === id)?.name ?? "";

  // 看圖卡密碼：已經有的從「印圖卡密碼」的清單找；沒有的先顯示產生按鈕
  async function openCards(s: Student) {
    setCards({ student: s, cards: null, confirm: false, error: "" });
    if (!s.hasCards) return;
    try {
      const list = await request<LoginCards[]>("GET", "login-cards");
      setCards({ student: s, cards: list.find((x) => x.studentId === s.id)?.cards ?? null, confirm: false, error: "" });
    } catch (err) {
      setCards({ student: s, cards: null, confirm: false, error: err instanceof ApiError ? err.message : "連線出了問題，請稍後再試" });
    }
  }

  async function generate(s: Student) {
    let fresh: number[] | null = null;
    const done = await act(async () => {
      fresh = (await request<{ cards: number[] }>("POST", `students/${s.id}/cards`)).cards;
    }, `已產生 ${s.displayName} 的圖卡密碼`);
    if (done) setCards({ student: { ...s, hasCards: true }, cards: fresh, confirm: false, error: "" });
  }

  async function save(e: Event) {
    e.preventDefault();
    if (!draft) return;
    const body = { displayName: draft.displayName, homeClass: draft.homeClass, homeroomTeacher: draft.homeroomTeacher, groupIds: draft.groupIds };
    const ok = await act(
      () => (draft.id ? request("PATCH", `students/${draft.id}`, body) : request("POST", "students", body)),
      draft.id ? `已更新 ${draft.displayName}` : `已新增 ${draft.displayName}`,
    );
    if (ok) setDraft(null);
  }

  const edit = (s: Student) =>
    setDraft({ id: s.id, displayName: s.displayName, homeClass: s.homeClass, homeroomTeacher: s.homeroomTeacher, groupIds: [...s.groupIds] });

  return (
    <section aria-labelledby="students-title">
      <div class="section-head">
        <h2 id="students-title">學生</h2>
        <div class="row-actions">
          {state.students.some((s) => s.active && s.hasCards) && (
            <a class="btn" href="/cards" target="_blank" rel="noopener">
              印圖卡密碼
            </a>
          )}
          <button class="btn primary" onClick={() => setDraft({ ...empty })}>
            新增學生
          </button>
        </div>
      </div>
      <p class="hint">只存顯示名、原班、導師稱呼與組別。顯示名可以用小名或「王〇明」。</p>
      {state.students.length === 0 ? (
        <p class="hint">還沒有學生。</p>
      ) : (
        <ul class="rows">
          {state.students.map((s) => (
            <li key={s.id} class={s.active ? "" : "inactive"}>
              <div class="row-main">
                <strong>{s.displayName}</strong>
                <span class="meta">
                  {[s.homeClass, s.homeroomTeacher].filter(Boolean).join("・")}
                  {s.groupIds.length > 0 && `｜${s.groupIds.map(groupName).join("、")}`}
                  {!s.active && "｜已停用"}
                  {s.active && !s.hasCards && "｜還沒有圖卡密碼"}
                </span>
              </div>
              <div class="row-actions">
                {s.active && (
                  <button class="btn small" onClick={() => openCards(s)} aria-label={`${s.displayName} 的圖卡密碼`}>
                    圖卡密碼
                  </button>
                )}
                <button class="btn small" onClick={() => edit(s)} aria-label={`編輯 ${s.displayName}`}>
                  編輯
                </button>
                <button
                  class="btn small"
                  onClick={() => act(() => request("PATCH", `students/${s.id}`, { active: !s.active }), s.active ? `已停用 ${s.displayName}` : `已啟用 ${s.displayName}`)}
                  aria-label={`${s.active ? "停用" : "啟用"} ${s.displayName}`}
                >
                  {s.active ? "停用" : "啟用"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={cards !== null} title={cards ? `${cards.student.displayName} 的圖卡密碼` : ""} onClose={() => setCards(null)}>
        {cards && (
          <div class="form">
            {cards.error && <p class="login-msg error">{cards.error}</p>}
            {cards.cards ? (
              <>
                <p class="hint">學生在學生平板上點自己的名字後，依照順序點這 3 張圖卡。</p>
                <ol class="card-seq">
                  {cards.cards.map((c, i) => (
                    <li key={i}>
                      <span class="seq-no">{i + 1}</span>
                      <CardPicture index={c} />
                      <span>{cardName(c)}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              !cards.student.hasCards && <p class="hint">還沒有圖卡密碼。產生之後，就可以在學生平板上登入。</p>
            )}
            {cards.confirm ? (
              <div class="form-actions spread">
                <p class="meta">重新產生後，舊的圖卡順序就不能用了。</p>
                <button class="btn" onClick={() => setCards({ ...cards, confirm: false })}>
                  取消
                </button>
                <button class="btn danger" onClick={() => generate(cards.student)}>
                  確定重新產生
                </button>
              </div>
            ) : (
              <div class="form-actions">
                {cards.student.hasCards ? (
                  <button class="btn quiet" onClick={() => setCards({ ...cards, confirm: true })}>
                    重新產生
                  </button>
                ) : (
                  <button class="btn primary" onClick={() => generate(cards.student)}>
                    產生圖卡密碼
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={draft !== null} title={draft?.id ? "編輯學生" : "新增學生"} onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={save} class="form">
            <div class="field">
              <label for="s-name">顯示名</label>
              <input
                id="s-name"
                required
                maxLength={LIMITS.name}
                pattern=".*\S.*"
                autoFocus
                value={draft.displayName}
                onInput={(e) => setDraft({ ...draft, displayName: e.currentTarget.value })}
                data-error="s-name-err"
              />
              <span class="error-msg" id="s-name-err">
                請填寫顯示名（最多 {LIMITS.name} 字）。
              </span>
            </div>
            <div class="field">
              <label for="s-class">原班</label>
              <input id="s-class" maxLength={LIMITS.name} placeholder="例如：五年一班" value={draft.homeClass} onInput={(e) => setDraft({ ...draft, homeClass: e.currentTarget.value })} />
            </div>
            <div class="field">
              <label for="s-teacher">導師稱呼</label>
              <input id="s-teacher" maxLength={LIMITS.name} placeholder="例如：王老師" value={draft.homeroomTeacher} onInput={(e) => setDraft({ ...draft, homeroomTeacher: e.currentTarget.value })} />
            </div>
            <fieldset class="field">
              <legend>組別（可複選）</legend>
              {state.groups.filter((g) => g.active || draft.groupIds.includes(g.id)).length === 0 && <p class="hint">還沒有組別，可以之後到「組別」新增。</p>}
              <div class="checks">
                {state.groups
                  .filter((g) => g.active || draft.groupIds.includes(g.id))
                  .map((g) => (
                    <label key={g.id} class="check">
                      <input
                        type="checkbox"
                        checked={draft.groupIds.includes(g.id)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            groupIds: e.currentTarget.checked ? [...draft.groupIds, g.id] : draft.groupIds.filter((x) => x !== g.id),
                          })
                        }
                      />
                      {g.name}
                    </label>
                  ))}
              </div>
            </fieldset>
            <div class="form-actions">
              <button type="submit" class="btn primary">
                {draft.id ? "儲存" : "新增"}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </section>
  );
}

export function GroupsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Group | null>(null);
  const [newName, setNewName] = useState("");
  const memberCount = (id: string) => state.students.filter((s) => s.active && s.groupIds.includes(id)).length;

  return (
    <section aria-labelledby="groups-title">
      <h2 id="groups-title">組別</h2>
      <p class="hint">組是「某科某組」，例如「國語五年級組」。同一位學生可以同時在好幾組。</p>
      <form
        class="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => request("POST", "groups", { name }), `已新增組別 ${name.trim()}`)) setName("");
        }}
      >
        <label for="g-new" class="visually-hidden">
          新組名
        </label>
        <input id="g-new" required maxLength={LIMITS.name} pattern=".*\S.*" placeholder="新組名" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <button class="btn primary" type="submit">
          新增組別
        </button>
      </form>
      <ul class="rows">
        {state.groups.map((g, i) => (
          <li key={g.id} class={g.active ? "" : "inactive"}>
            <span class="swatch" style={{ "--paper": paperAt(i).hue }} title={paperAt(i).name} aria-hidden="true" />
            <div class="row-main">
              <strong>{g.name}</strong>
              <span class="meta">
                {memberCount(g.id)} 位學生{!g.active && "｜已停用"}
              </span>
            </div>
            <div class="row-actions">
              <button
                class="btn small"
                aria-label={`改名 ${g.name}`}
                onClick={() => {
                  setEditing(g);
                  setNewName(g.name);
                }}
              >
                改名
              </button>
              <button
                class="btn small"
                aria-label={`${g.active ? "停用" : "啟用"} ${g.name}`}
                onClick={() => act(() => request("PATCH", `groups/${g.id}`, { active: !g.active }), g.active ? `已停用 ${g.name}` : `已啟用 ${g.name}`)}
              >
                {g.active ? "停用" : "啟用"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={editing !== null} title="組別改名" onClose={() => setEditing(null)}>
        {editing && (
          <form
            class="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(() => request("PATCH", `groups/${editing.id}`, { name: newName }), `已改名為 ${newName.trim()}`)) setEditing(null);
            }}
          >
            <div class="field">
              <label for="g-rename">組名</label>
              <input id="g-rename" required autoFocus maxLength={LIMITS.name} pattern=".*\S.*" value={newName} onInput={(e) => setNewName(e.currentTarget.value)} />
            </div>
            <div class="form-actions">
              <button class="btn primary" type="submit">
                儲存
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </section>
  );
}
