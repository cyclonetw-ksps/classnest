import { useState } from "preact/hooks";
import { LIMITS, type Board, type BoardCard, type CardKind, type ClassState, type ShareInfo } from "../shared/types";
import { request } from "./api";
import type { Act } from "./App";
import { CopyButton } from "./copy";
import { Dialog } from "./Dialog";
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, QrIcon, Share } from "./icons";
import { boardPaper, KIND_LABEL, Note } from "./notes";
import { paperAt } from "./palette";
import { QrCode } from "./qr";

type BoardDraft = { id?: string; title: string; groupIds: string[]; shared: boolean };
type CardDraft = { id?: string; boardId: string; kind: CardKind; title: string; body: string; url: string; dueDate: string };

export const shareUrl = (share: ShareInfo, groupId = "") => `${location.origin}/s/${share.code}${groupId ? `#${groupId}` : ""}`;

export function BoardPanel({ state, act }: { state: ClassState; act: Act }) {
  const [boardDraft, setBoardDraft] = useState<BoardDraft | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [confirmBoard, setConfirmBoard] = useState(false);
  const [confirmCard, setConfirmCard] = useState(false);
  const [shareOpen, setShareOpen] = useState<"" | "qr" | "settings">("");
  const [freshCard, setFreshCard] = useState("");

  const colorOf = (id: string) => state.groups.findIndex((g) => g.id === id);
  const groupName = (id: string) => state.groups.find((g) => g.id === id)?.name ?? "";
  const boards = state.boards;
  const sharedCount = boards.filter((b) => b.shared).length;

  async function saveBoard(e: Event) {
    e.preventDefault();
    if (!boardDraft) return;
    const body = { title: boardDraft.title, groupIds: boardDraft.groupIds, shared: boardDraft.shared };
    const ok = await act(
      () => (boardDraft.id ? request("PATCH", `boards/${boardDraft.id}`, body) : request("POST", "boards", body)),
      boardDraft.id ? `已更新面板「${boardDraft.title.trim()}」` : `已新增面板「${boardDraft.title.trim()}」`,
    );
    if (ok) setBoardDraft(null);
  }

  async function deleteBoard() {
    if (!boardDraft?.id) return;
    const ok = await act(() => request("DELETE", `boards/${boardDraft.id}`), `已刪除面板「${boardDraft.title}」`);
    if (ok) {
      setConfirmBoard(false);
      setBoardDraft(null);
    }
  }

  async function saveCard(e: Event) {
    e.preventDefault();
    if (!cardDraft) return;
    const body = {
      boardId: cardDraft.boardId,
      kind: cardDraft.kind,
      title: cardDraft.title,
      body: cardDraft.body,
      url: cardDraft.kind === "text" ? "" : cardDraft.url,
      dueDate: cardDraft.kind === "homework" && cardDraft.dueDate ? cardDraft.dueDate : null,
    };
    const name = cardDraft.title.trim() || KIND_LABEL[cardDraft.kind] + "卡";
    let created = "";
    const ok = await act(
      async () => {
        if (cardDraft.id) return request("PATCH", `cards/${cardDraft.id}`, body);
        created = (await request<BoardCard>("POST", "cards", body)).id;
      },
      cardDraft.id ? `已更新「${name}」` : `已貼上「${name}」`,
    );
    if (ok) {
      setCardDraft(null);
      if (created) setFreshCard(created);
    }
  }

  async function deleteCard() {
    if (!cardDraft?.id) return;
    const ok = await act(() => request("DELETE", `cards/${cardDraft.id}`), "已刪除卡片");
    if (ok) {
      setConfirmCard(false);
      setCardDraft(null);
    }
  }

  const moveBoard = (b: Board, to: number, word: string) => act(() => request("PATCH", `boards/${b.id}`, { position: to }), `已把面板「${b.title}」${word}`);
  const moveCard = (c: BoardCard, to: number, word: string) =>
    act(() => request("PATCH", `cards/${c.id}`, { position: to }), `已把「${c.title || KIND_LABEL[c.kind] + "卡"}」${word}`);

  const editCard = (boardId: string, c: BoardCard) =>
    setCardDraft({ id: c.id, boardId, kind: c.kind, title: c.title, body: c.body, url: c.url, dueDate: c.dueDate ?? "" });

  const byWhom = (c: BoardCard) => (c.createdBy.startsWith("agent：") ? c.createdBy : (state.teachers.find((t) => t.email === c.createdBy)?.name ?? c.createdBy));

  return (
    <section aria-labelledby="board-title" class="board-tab">
      <div class="section-head">
        <h2 id="board-title">公布欄</h2>
        <button class="btn primary" onClick={() => setBoardDraft({ title: "", groupIds: [], shared: false })}>
          <Plus />
          新增面板
        </button>
      </div>

      <div class="share-strip">
        <div class="row-main">
          <strong>分享連結</strong>
          <span class="meta">
            {sharedCount > 0
              ? `${sharedCount} 個面板分享中｜${state.share.hasPin ? "有通關碼" : "沒有通關碼"}`
              : "把面板設成「分享」後，才有內容可以給代課老師和學生看"}
          </span>
        </div>
        <div class="row-actions">
          {sharedCount > 0 && (
            <>
              <CopyButton text={shareUrl(state.share)} label="複製分享連結">
                複製連結
              </CopyButton>
              <button class="btn small" onClick={() => setShareOpen("qr")}>
                <QrIcon />
                QR Code
              </button>
            </>
          )}
          <button class="btn small" onClick={() => setShareOpen("settings")}>
            分享設定
          </button>
        </div>
      </div>

      {boards.length === 0 ? (
        <div class="board-start">
          <p class="hint">公布欄還是空的。點一張範例面板就建好，之後可以改名；也可以按「新增面板」自己取名。</p>
          <ol class="boards">
            {[
              { title: "本週進度", note: "全班・分享：讓代課老師知道這週上到哪裡" },
              { title: "回家作業", note: "全班・分享：作業連結可以放大成 QR Code" },
            ].map((t, i) => (
              <li key={t.title} class="board-col" style={{ "--paper": i === 0 ? "var(--paper-sun)" : "var(--paper-red)" }}>
                <button
                  type="button"
                  class="board-strip board-sample"
                  onClick={() => act(() => request("POST", "boards", { title: t.title, shared: true }), `已新增面板「${t.title}」`)}
                >
                  <span class="sample-title">
                    <Plus />
                    {t.title}
                  </span>
                  <span class="board-meta">{t.note}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <ol class="boards">
          {boards.map((b, i) => {
            const paper = boardPaper(b.groupIds, colorOf);
            return (
              <li key={b.id} class="board-col" style={{ "--paper": paper.hue }}>
                <header class="board-strip">
                  <h3>{b.title}</h3>
                  <p class="board-meta">
                    <span class={`board-scope ${b.shared ? "shared" : ""}`}>
                      {b.shared ? <Share /> : <Lock />}
                      {b.shared ? "分享中" : "私人"}
                    </span>
                    <span class="board-groups">{b.groupIds.length ? b.groupIds.map(groupName).filter(Boolean).join("、") : "全班"}</span>
                  </p>
                  <div class="board-actions">
                    <button class="btn small" onClick={() => setCardDraft({ boardId: b.id, kind: "text", title: "", body: "", url: "", dueDate: "" })}>
                      <Plus />
                      貼卡片
                    </button>
                    <button class="icon-btn" aria-label={`編輯面板「${b.title}」`} title="編輯面板" onClick={() => setBoardDraft({ id: b.id, title: b.title, groupIds: [...b.groupIds], shared: b.shared })}>
                      <Pencil />
                    </button>
                    <button class="icon-btn" aria-label={`把面板「${b.title}」往前移`} title="往前移" disabled={i === 0} onClick={() => moveBoard(b, i - 1, "往前移")}>
                      <ArrowUp />
                    </button>
                    <button class="icon-btn" aria-label={`把面板「${b.title}」往後移`} title="往後移" disabled={i === boards.length - 1} onClick={() => moveBoard(b, i + 1, "往後移")}>
                      <ArrowDown />
                    </button>
                  </div>
                </header>
                {b.cards.length === 0 ? (
                  <p class="board-blank">還沒有卡片</p>
                ) : (
                  <ol class="notes">
                    {b.cards.map((c, j) => (
                      <li key={c.id}>
                        <Note
                          card={c}
                          fresh={c.id === freshCard}
                          footer={c.createdBy.startsWith("agent：") ? `由 ${byWhom(c)} 貼上` : undefined}
                          actions={
                            <>
                              <button class="icon-btn" aria-label={`編輯「${c.title || KIND_LABEL[c.kind] + "卡"}」`} title="編輯" onClick={() => editCard(b.id, c)}>
                                <Pencil />
                              </button>
                              <button class="icon-btn" aria-label={`把「${c.title || KIND_LABEL[c.kind] + "卡"}」往上移`} title="往上移" disabled={j === 0} onClick={() => moveCard(c, j - 1, "往上移")}>
                                <ArrowUp />
                              </button>
                              <button
                                class="icon-btn"
                                aria-label={`把「${c.title || KIND_LABEL[c.kind] + "卡"}」往下移`}
                                title="往下移"
                                disabled={j === b.cards.length - 1}
                                onClick={() => moveCard(c, j + 1, "往下移")}
                              >
                                <ArrowDown />
                              </button>
                            </>
                          }
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={boardDraft !== null} title={boardDraft?.id ? "編輯面板" : "新增面板"} onClose={() => (setBoardDraft(null), setConfirmBoard(false))}>
        {boardDraft && !confirmBoard && (
          <form onSubmit={saveBoard} class="form">
            <div class="field">
              <label for="b-title">面板名稱</label>
              <input
                id="b-title"
                required
                maxLength={LIMITS.boardTitle}
                pattern=".*\S.*"
                autoFocus
                placeholder="例如：本週進度、回家作業"
                value={boardDraft.title}
                onInput={(e) => setBoardDraft({ ...boardDraft, title: e.currentTarget.value })}
                data-error="b-title-err"
              />
              <span class="error-msg" id="b-title-err">
                請填寫面板名稱（最多 {LIMITS.boardTitle} 字）。
              </span>
            </div>
            <fieldset class="field">
              <legend>給哪些組（不勾就是全班）</legend>
              {state.groups.filter((g) => g.active || boardDraft.groupIds.includes(g.id)).length === 0 && <p class="hint">還沒有組別；不勾就是全班。</p>}
              <div class="checks">
                {state.groups
                  .filter((g) => g.active || boardDraft.groupIds.includes(g.id))
                  .map((g) => (
                    <label key={g.id} class="check" style={{ "--paper": paperAt(colorOf(g.id)).hue }}>
                      <input
                        type="checkbox"
                        checked={boardDraft.groupIds.includes(g.id)}
                        onChange={(e) =>
                          setBoardDraft({
                            ...boardDraft,
                            groupIds: e.currentTarget.checked ? [...boardDraft.groupIds, g.id] : boardDraft.groupIds.filter((x) => x !== g.id),
                          })
                        }
                      />
                      <span class="swatch-dot" aria-hidden="true" />
                      {g.name}
                    </label>
                  ))}
              </div>
            </fieldset>
            <fieldset class="field">
              <legend>誰看得到</legend>
              <div class="choices">
                <label class="choice">
                  <input type="radio" name="b-shared" checked={!boardDraft.shared} onChange={() => setBoardDraft({ ...boardDraft, shared: false })} />
                  <span>
                    <strong>私人</strong>
                    <span class="meta">只有登入的老師看得到</span>
                  </span>
                </label>
                <label class="choice">
                  <input type="radio" name="b-shared" checked={boardDraft.shared} onChange={() => setBoardDraft({ ...boardDraft, shared: true })} />
                  <span>
                    <strong>分享</strong>
                    <span class="meta">打開分享連結的代課老師、學生、家長都看得到</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <div class="form-actions spread">
              {boardDraft.id ? (
                <button type="button" class="btn quiet" onClick={() => setConfirmBoard(true)}>
                  刪除面板
                </button>
              ) : (
                <span />
              )}
              <button type="submit" class="btn primary">
                {boardDraft.id ? "儲存" : "新增面板"}
              </button>
            </div>
          </form>
        )}
        {boardDraft && confirmBoard && (
          <div class="form">
            <p>
              確定刪除面板「{boardDraft.title}」？裡面 {boards.find((b) => b.id === boardDraft.id)?.cards.length ?? 0} 張卡片會一起刪掉，無法復原。
            </p>
            <div class="form-actions">
              <button type="button" class="btn" onClick={() => setConfirmBoard(false)}>
                不刪了
              </button>
              <button type="button" class="btn danger" onClick={deleteBoard}>
                確定刪除
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={cardDraft !== null} title={cardDraft?.id ? "編輯卡片" : "貼一張卡片"} onClose={() => (setCardDraft(null), setConfirmCard(false))}>
        {cardDraft && !confirmCard && (
          <form onSubmit={saveCard} class="form">
            <fieldset class="field">
              <legend>種類</legend>
              <div class="segmented">
                {(["text", "link", "homework"] as const).map((k) => (
                  <label key={k}>
                    <input type="radio" name="c-kind" checked={cardDraft.kind === k} onChange={() => setCardDraft({ ...cardDraft, kind: k })} />
                    <span>{KIND_LABEL[k]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div class="field">
              <label for="c-title">標題{cardDraft.kind === "text" ? "（標題或內容至少填一個）" : ""}</label>
              <input
                id="c-title"
                required={cardDraft.kind !== "text"}
                pattern={cardDraft.kind !== "text" ? ".*\\S.*" : undefined}
                maxLength={LIMITS.cardTitle}
                autoFocus
                placeholder={cardDraft.kind === "homework" ? "例如：數學習作" : cardDraft.kind === "link" ? "例如：均一影片：分數加法" : "例如：明天帶色鉛筆"}
                value={cardDraft.title}
                onInput={(e) => setCardDraft({ ...cardDraft, title: e.currentTarget.value })}
                data-error="c-title-err"
              />
              <span class="error-msg" id="c-title-err">
                請填寫標題（最多 {LIMITS.cardTitle} 字）。
              </span>
            </div>
            <div class="field">
              <label for="c-body">內容</label>
              <textarea
                id="c-body"
                rows={3}
                maxLength={LIMITS.cardBody}
                placeholder={cardDraft.kind === "homework" ? "例如：p.12–13，寫完請家長簽名" : ""}
                value={cardDraft.body}
                onInput={(e) => setCardDraft({ ...cardDraft, body: e.currentTarget.value })}
              />
            </div>
            {cardDraft.kind !== "text" && (
              <div class="field">
                <label for="c-url">網址{cardDraft.kind === "homework" ? "（可空白）" : ""}</label>
                <input
                  id="c-url"
                  type="url"
                  inputMode="url"
                  required={cardDraft.kind === "link"}
                  pattern="https?://.+"
                  maxLength={LIMITS.url}
                  placeholder="https://"
                  value={cardDraft.url}
                  onInput={(e) => setCardDraft({ ...cardDraft, url: e.currentTarget.value })}
                  data-error="c-url-err"
                />
                <span class="error-msg" id="c-url-err">
                  請貼上以 http:// 或 https:// 開頭的網址。
                </span>
              </div>
            )}
            {cardDraft.kind === "homework" && (
              <div class="field">
                <label for="c-due">繳交日期（可空白）</label>
                <input id="c-due" type="date" value={cardDraft.dueDate} onInput={(e) => setCardDraft({ ...cardDraft, dueDate: e.currentTarget.value })} />
              </div>
            )}
            <div class="form-actions spread">
              {cardDraft.id ? (
                <button type="button" class="btn quiet" onClick={() => setConfirmCard(true)}>
                  刪除卡片
                </button>
              ) : (
                <span />
              )}
              <button type="submit" class="btn primary">
                {cardDraft.id ? "儲存" : "貼上"}
              </button>
            </div>
          </form>
        )}
        {cardDraft && confirmCard && (
          <div class="form">
            <p>確定刪除「{cardDraft.title || KIND_LABEL[cardDraft.kind] + "卡"}」？無法復原。</p>
            <div class="form-actions">
              <button type="button" class="btn" onClick={() => setConfirmCard(false)}>
                不刪了
              </button>
              <button type="button" class="btn danger" onClick={deleteCard}>
                確定刪除
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <ShareQrDialog open={shareOpen === "qr"} state={state} onClose={() => setShareOpen("")} />
      <ShareSettingsDialog open={shareOpen === "settings"} state={state} act={act} onClose={() => setShareOpen("")} />
    </section>
  );
}

function ShareQrDialog({ open, state, onClose }: { open: boolean; state: ClassState; onClose: () => void }) {
  const [groupId, setGroupId] = useState("");
  const groups = state.groups.filter((g) => g.active && state.boards.some((b) => b.shared && b.groupIds.includes(g.id)));
  const url = shareUrl(state.share, groupId);
  return (
    <Dialog open={open} title="分享連結" onClose={onClose} wide>
      <div class="qr-view">
        {groups.length > 0 && (
          <div class="field">
            <label for="qr-group">打開時先顯示</label>
            <select id="qr-group" value={groupId} onChange={(e) => setGroupId(e.currentTarget.value)}>
              <option value="">全部分享的面板</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <QrCode text={url} label="分享連結的 QR Code" />
        <p class="qr-url">{url}</p>
        {state.share.hasPin && <p class="hint">這個連結有通關碼，記得把通關碼一起告訴學生或代課老師。</p>}
        <div class="form-actions">
          <CopyButton text={url} label="複製分享連結">
            複製連結
          </CopyButton>
          <a class="btn primary" href={url} target="_blank" rel="noopener">
            打開分享頁
          </a>
        </div>
      </div>
    </Dialog>
  );
}

function ShareSettingsDialog({ open, state, act, onClose }: { open: boolean; state: ClassState; act: Act; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const close = () => (setPin(""), setConfirmReset(false), onClose());
  return (
    <Dialog open={open} title="分享設定" onClose={close}>
      <div class="form">
        <h4 class="dialog-sub">通關碼</h4>
        <p class="hint">
          {state.share.hasPin ? "目前有通關碼。打開分享連結要先輸入 4 位數字。" : "目前沒有通關碼，拿到連結的人都看得到分享的面板。"}
        </p>
        <form
          class="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act(() => request("PUT", "share", { pin }), "已設定通關碼")) setPin("");
          }}
        >
          <label for="share-pin" class="visually-hidden">
            新的 4 位數通關碼
          </label>
          <input
            id="share-pin"
            class="num"
            inputMode="numeric"
            autoComplete="off"
            required
            pattern="\d{4}"
            maxLength={4}
            placeholder="4 位數字"
            value={pin}
            onInput={(e) => setPin(e.currentTarget.value)}
          />
          <button class="btn primary" type="submit">
            {state.share.hasPin ? "換通關碼" : "設定通關碼"}
          </button>
        </form>
        {state.share.hasPin && (
          <div class="form-actions start">
            <button type="button" class="btn quiet" onClick={() => act(() => request("PUT", "share", { pin: null }), "已取消通關碼")}>
              取消通關碼
            </button>
          </div>
        )}

        <h4 class="dialog-sub">換一個新連結</h4>
        <p class="hint">連結外流時用。舊連結會立刻打不開，已經發出去的連結和 QR Code 要重新給。</p>
        {!confirmReset ? (
          <div class="form-actions start">
            <button type="button" class="btn" onClick={() => setConfirmReset(true)}>
              換新連結
            </button>
          </div>
        ) : (
          <div class="form-actions start">
            <button type="button" class="btn" onClick={() => setConfirmReset(false)}>
              不換了
            </button>
            <button
              type="button"
              class="btn danger"
              onClick={async () => {
                if (await act(() => request("POST", "share/reset"), "已換新分享連結，舊連結已失效")) setConfirmReset(false);
              }}
            >
              確定換新連結
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
