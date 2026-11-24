// 公布欄（面板與卡片）、分享頁與 agent 金鑰。資料和班級其他資料放在同一個 Durable Object 的 SQLite。
//
// 權限邊界：
// - 老師（Google 登入）可以做全部的事。
// - agent 金鑰只能讀組別名稱、讀寫面板與卡片；學生、分數、獎勵、老師、設定一律碰不到（見 agentTool 的白名單）。
// - 分享頁（代碼＋可選通關碼）只看得到「分享」的面板與組別名稱，沒有學生資料，也不顯示是誰貼的。
import {
  LIMITS,
  type AgentKey,
  type Board,
  type BoardCard,
  type CardKind,
  type PublicBoard,
  type PublicView,
  type ShareInfo,
} from "../shared/types";
import { bool, fail, idList, InputError, int, newId, ok, sha256Hex, text, type Body, type Result } from "./validate";

export interface AgentIdentity {
  id: string;
  name: string;
}

const KINDS: CardKind[] = ["text", "link", "homework"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PIN_RE = /^\d{4}$/;

function randomToken(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function webUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new InputError("網址格式不正確，要以 http:// 或 https:// 開頭");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new InputError("網址要以 http:// 或 https:// 開頭");
  if (u.href.length > LIMITS.url) throw new InputError(`網址最多 ${LIMITS.url} 個字`);
  return u.href;
}

function dueDate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !DATE_RE.test(v)) throw new InputError("繳交日期格式要是 YYYY-MM-DD");
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new InputError("繳交日期不是有效的日期");
  return v;
}

type CardRow = {
  id: string;
  board_id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  due_date: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
};

export class BoardStore {
  constructor(
    private sql: SqlStorage,
    private storage: DurableObjectStorage,
  ) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, shared INTEGER NOT NULL, position INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS board_groups (
        board_id TEXT NOT NULL, group_id TEXT NOT NULL, PRIMARY KEY (board_id, group_id));
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY, board_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
        url TEXT NOT NULL, due_date TEXT, position INTEGER NOT NULL, created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS cards_board ON cards (board_id, position);
      CREATE TABLE IF NOT EXISTS agent_keys (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, active INTEGER NOT NULL,
        created_by TEXT NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER);
    `);
    if (!this.setting("share_code")) this.putSetting("share_code", randomToken(16));
  }

  /* ---------- 小工具 ---------- */

  private setting(key: string): string | undefined {
    return this.sql.exec<{ value: string }>("SELECT value FROM settings WHERE key = ?", key).toArray()[0]?.value;
  }

  private putSetting(key: string, value: string | null): void {
    if (value === null) this.sql.exec("DELETE FROM settings WHERE key = ?", key);
    else this.sql.exec("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  }

  private boardExists(id: string): boolean {
    return this.sql.exec("SELECT 1 FROM boards WHERE id = ?", id).toArray().length > 0;
  }

  private checkGroups(groupIds: string[]): void {
    for (const g of groupIds) {
      if (!this.sql.exec("SELECT 1 FROM class_groups WHERE id = ?", g).toArray().length) throw new InputError("指定的組別不存在");
    }
  }

  // 把 ids 依序重新編號；target 移到 index（超出範圍就放到頭或尾）
  private reorder(table: "boards" | "cards", ids: string[], target: string, index: number): void {
    const rest = ids.filter((id) => id !== target);
    const at = Math.max(0, Math.min(index, rest.length));
    rest.splice(at, 0, target);
    rest.forEach((id, i) => this.sql.exec(`UPDATE ${table} SET position = ? WHERE id = ?`, i, id));
  }

  private boardIds(): string[] {
    return this.sql.exec<{ id: string }>("SELECT id FROM boards ORDER BY position, created_at").toArray().map((r) => r.id);
  }

  private cardIds(boardId: string): string[] {
    return this.sql
      .exec<{ id: string }>("SELECT id FROM cards WHERE board_id = ? ORDER BY position, created_at", boardId)
      .toArray()
      .map((r) => r.id);
  }

  /* ---------- 面板 ---------- */

  createBoard(body: Body): Result<Board> {
    const title = text(body, "title", LIMITS.boardTitle, { required: true, label: "面板名稱" })!;
    const groupIds = idList(body, "groupIds", LIMITS.groups) ?? [];
    const shared = bool(body, "shared") ?? false;
    this.checkGroups(groupIds);
    if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM boards").one().n >= LIMITS.boards) {
      return fail(400, `最多 ${LIMITS.boards} 個面板`);
    }
    const id = newId();
    const position = this.sql.exec<{ p: number | null }>("SELECT MAX(position) AS p FROM boards").one().p ?? -1;
    this.storage.transactionSync(() => {
      this.sql.exec("INSERT INTO boards (id, title, shared, position, created_at) VALUES (?, ?, ?, ?, ?)", id, title, shared ? 1 : 0, position + 1, Date.now());
      for (const g of groupIds) this.sql.exec("INSERT INTO board_groups (board_id, group_id) VALUES (?, ?)", id, g);
    });
    return ok(this.boards().find((b) => b.id === id)!);
  }

  updateBoard(id: string, body: Body): Result<{ id: string }> {
    if (!this.boardExists(id)) return fail(404, "找不到這個面板");
    const title = text(body, "title", LIMITS.boardTitle, { label: "面板名稱" });
    const groupIds = idList(body, "groupIds", LIMITS.groups);
    const shared = bool(body, "shared");
    const position = int(body, "position", 0, LIMITS.boards, { label: "位置" });
    if (title !== undefined && !title) return fail(400, "請填寫面板名稱");
    if (groupIds) this.checkGroups(groupIds);
    this.storage.transactionSync(() => {
      if (title !== undefined) this.sql.exec("UPDATE boards SET title = ? WHERE id = ?", title, id);
      if (shared !== undefined) this.sql.exec("UPDATE boards SET shared = ? WHERE id = ?", shared ? 1 : 0, id);
      if (groupIds) {
        this.sql.exec("DELETE FROM board_groups WHERE board_id = ?", id);
        for (const g of groupIds) this.sql.exec("INSERT INTO board_groups (board_id, group_id) VALUES (?, ?)", id, g);
      }
      if (position !== undefined) this.reorder("boards", this.boardIds(), id, position);
    });
    return ok({ id });
  }

  deleteBoard(id: string): Result<{ id: string }> {
    if (!this.boardExists(id)) return fail(404, "找不到這個面板");
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM cards WHERE board_id = ?", id);
      this.sql.exec("DELETE FROM board_groups WHERE board_id = ?", id);
      this.sql.exec("DELETE FROM boards WHERE id = ?", id);
    });
    return ok({ id });
  }

  /* ---------- 卡片 ---------- */

  // 合併後整張卡一起檢查，新增與修改用同一套規則
  private validCard(c: { kind: unknown; title: string; body: string; url: string }): CardKind {
    if (typeof c.kind !== "string" || !KINDS.includes(c.kind as CardKind)) throw new InputError("卡片種類要是文字、連結或作業");
    const kind = c.kind as CardKind;
    if (kind === "text" && !c.title && !c.body) throw new InputError("文字卡請填寫標題或內容");
    if (kind !== "text" && !c.title) throw new InputError("請填寫卡片標題");
    if (kind === "link" && !c.url) throw new InputError("連結卡請填寫網址");
    return kind;
  }

  private cardFields(body: Body) {
    const title = text(body, "title", LIMITS.cardTitle, { label: "卡片標題" });
    const content = text(body, "body", LIMITS.cardBody, { label: "卡片內容" });
    const rawUrl = text(body, "url", LIMITS.url, { label: "網址" });
    const url = rawUrl === undefined ? undefined : rawUrl ? webUrl(rawUrl) : "";
    return { title, body: content, url, dueDate: dueDate(body.dueDate) };
  }

  createCard(actor: string, body: Body): Result<BoardCard> {
    const boardId = text(body, "boardId", 40, { required: true, label: "面板" })!;
    if (!this.boardExists(boardId)) return fail(404, "找不到這個面板");
    const f = this.cardFields(body);
    const card = { kind: body.kind, title: f.title ?? "", body: f.body ?? "", url: f.url ?? "" };
    const kind = this.validCard(card);
    if (this.cardIds(boardId).length >= LIMITS.cardsPerBoard) return fail(400, `一個面板最多 ${LIMITS.cardsPerBoard} 張卡片`);
    const position = this.sql.exec<{ p: number | null }>("SELECT MAX(position) AS p FROM cards WHERE board_id = ?", boardId).one().p ?? -1;
    const id = newId();
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO cards (id, board_id, kind, title, body, url, due_date, position, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      boardId,
      kind,
      card.title,
      card.body,
      card.url,
      kind === "homework" ? (f.dueDate ?? null) : null,
      position + 1,
      actor,
      now,
      now,
    );
    return ok(this.card(id)!);
  }

  updateCard(id: string, body: Body): Result<BoardCard> {
    const row = this.sql.exec<CardRow>("SELECT * FROM cards WHERE id = ?", id).toArray()[0];
    if (!row) return fail(404, "找不到這張卡片");
    const f = this.cardFields(body);
    const position = int(body, "position", 0, LIMITS.cardsPerBoard, { label: "位置" });
    const merged = {
      kind: body.kind ?? row.kind,
      title: f.title ?? row.title,
      body: f.body ?? row.body,
      url: f.url ?? row.url,
    };
    const kind = this.validCard(merged);
    const due = kind === "homework" ? (f.dueDate === undefined ? row.due_date : f.dueDate) : null;
    this.storage.transactionSync(() => {
      this.sql.exec(
        "UPDATE cards SET kind = ?, title = ?, body = ?, url = ?, due_date = ?, updated_at = ? WHERE id = ?",
        kind,
        merged.title,
        merged.body,
        merged.url,
        due,
        Date.now(),
        id,
      );
      if (position !== undefined) this.reorder("cards", this.cardIds(row.board_id), id, position);
    });
    return ok(this.card(id)!);
  }

  deleteCard(id: string): Result<{ id: string }> {
    if (!this.sql.exec("SELECT 1 FROM cards WHERE id = ?", id).toArray().length) return fail(404, "找不到這張卡片");
    this.sql.exec("DELETE FROM cards WHERE id = ?", id);
    return ok({ id });
  }

  /* ---------- 讀取 ---------- */

  private toCard(r: CardRow): BoardCard {
    return {
      id: r.id,
      kind: r.kind as CardKind,
      title: r.title,
      body: r.body,
      url: r.url,
      dueDate: r.due_date,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private card(id: string): BoardCard | null {
    const r = this.sql.exec<CardRow>("SELECT * FROM cards WHERE id = ?", id).toArray()[0];
    return r ? this.toCard(r) : null;
  }

  boards(): Board[] {
    const groups = new Map<string, string[]>();
    for (const m of this.sql.exec<{ board_id: string; group_id: string }>("SELECT board_id, group_id FROM board_groups").toArray()) {
      const list = groups.get(m.board_id) ?? [];
      list.push(m.group_id);
      groups.set(m.board_id, list);
    }
    const cards = new Map<string, BoardCard[]>();
    for (const r of this.sql.exec<CardRow>("SELECT * FROM cards ORDER BY position, created_at").toArray()) {
      const list = cards.get(r.board_id) ?? [];
      list.push(this.toCard(r));
      cards.set(r.board_id, list);
    }
    return this.sql
      .exec<{ id: string; title: string; shared: number }>("SELECT id, title, shared FROM boards ORDER BY position, created_at")
      .toArray()
      .map((b) => ({ id: b.id, title: b.title, shared: !!b.shared, groupIds: groups.get(b.id) ?? [], cards: cards.get(b.id) ?? [] }));
  }

  activeGroups(): { id: string; name: string }[] {
    return this.sql
      .exec<{ id: string; name: string }>("SELECT id, name FROM class_groups WHERE active = 1 ORDER BY created_at, rowid")
      .toArray()
      .map((g) => ({ id: g.id, name: g.name }));
  }

  /* ---------- 分享 ---------- */

  share(): ShareInfo {
    return { code: this.setting("share_code")!, hasPin: !!this.setting("share_pin_hash") };
  }

  async setPin(body: Body): Promise<Result<ShareInfo>> {
    const pin = body.pin;
    if (pin !== null && (typeof pin !== "string" || !PIN_RE.test(pin))) return fail(400, "通關碼要是 4 位數字");
    if (pin === null) {
      this.putSetting("share_pin_salt", null);
      this.putSetting("share_pin_hash", null);
    } else {
      const salt = randomToken(12);
      this.putSetting("share_pin_salt", salt);
      this.putSetting("share_pin_hash", await sha256Hex(`${salt}:${pin}`));
    }
    this.clearPinFails();
    return ok(this.share());
  }

  resetShare(): Result<ShareInfo> {
    this.putSetting("share_code", randomToken(16));
    this.clearPinFails();
    return ok(this.share());
  }

  private clearPinFails(): void {
    this.putSetting("pin_fails", null);
    this.putSetting("pin_locked_until", null);
  }

  // 分享頁：代碼不對回 404；設了通關碼要答對；連續答錯 LIMITS.pinAttempts 次後暫停 LIMITS.pinLockMs
  async publicView(code: string, body: Body): Promise<{ status: number; json: string }> {
    const reply = (status: number, data: unknown) => ({ status, json: JSON.stringify(data) });
    if (!code || code !== this.setting("share_code")) return reply(404, { error: "這個分享連結已失效，請向老師索取新的連結" });
    const hash = this.setting("share_pin_hash");
    if (hash) {
      const now = Date.now();
      const lockedUntil = Number(this.setting("pin_locked_until") ?? 0);
      if (now < lockedUntil) return reply(429, { error: "通關碼錯太多次，請過幾分鐘再試", needPin: true });
      const pin = typeof body.pin === "string" ? body.pin : "";
      if (!pin) return reply(401, { error: "請輸入通關碼", needPin: true });
      if ((await sha256Hex(`${this.setting("share_pin_salt")}:${pin}`)) !== hash) {
        const fails = Number(this.setting("pin_fails") ?? 0) + 1;
        if (fails >= LIMITS.pinAttempts) {
          this.putSetting("pin_fails", null);
          this.putSetting("pin_locked_until", String(now + LIMITS.pinLockMs));
        } else {
          this.putSetting("pin_fails", String(fails));
        }
        return reply(401, { error: "通關碼不對", needPin: true });
      }
      this.putSetting("pin_fails", null);
    }
    const group = typeof body.group === "string" ? body.group : "";
    const shared = this.boards().filter((b) => b.shared);
    const used = new Set(shared.flatMap((b) => b.groupIds));
    const boards: PublicBoard[] = shared
      .filter((b) => !group || b.groupIds.length === 0 || b.groupIds.includes(group))
      .map((b) => ({
        id: b.id,
        title: b.title,
        groupIds: b.groupIds,
        cards: b.cards.map(({ createdBy: _hidden, ...card }) => card),
      }));
    const order = this.sql
      .exec<{ id: string }>("SELECT id FROM class_groups ORDER BY created_at, rowid")
      .toArray()
      .map((g) => g.id);
    const view: PublicView = {
      title: this.setting("title") ?? "",
      groups: this.activeGroups()
        .filter((g) => used.has(g.id))
        .map((g) => ({ ...g, color: order.indexOf(g.id) })),
      boards,
    };
    return reply(200, view);
  }

  /* ---------- agent 金鑰 ---------- */

  agentKeys(): AgentKey[] {
    return this.sql
      .exec<{ id: string; name: string; active: number; created_by: string; created_at: number; last_used_at: number | null }>(
        "SELECT id, name, active, created_by, created_at, last_used_at FROM agent_keys ORDER BY created_at",
      )
      .toArray()
      .map((k) => ({ id: k.id, name: k.name, active: !!k.active, createdBy: k.created_by, createdAt: k.created_at, lastUsedAt: k.last_used_at }));
  }

  // 金鑰是 32 bytes 隨機字串，猜不到，所以只存 SHA-256；原始金鑰只在這裡回傳一次
  async createKey(actor: string, body: Body): Promise<Result<{ id: string; name: string; key: string }>> {
    const name = text(body, "name", LIMITS.keyName, { required: true, label: "金鑰名稱" })!;
    if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM agent_keys").one().n >= LIMITS.agentKeys) {
      return fail(400, `最多 ${LIMITS.agentKeys} 把金鑰`);
    }
    const id = newId();
    const key = `cnk_${randomToken(32)}`;
    this.sql.exec(
      "INSERT INTO agent_keys (id, name, hash, active, created_by, created_at) VALUES (?, ?, ?, 1, ?, ?)",
      id,
      name,
      await sha256Hex(key),
      actor,
      Date.now(),
    );
    return ok({ id, name, key });
  }

  updateKey(id: string, body: Body): Result<{ id: string }> {
    if (!this.sql.exec("SELECT 1 FROM agent_keys WHERE id = ?", id).toArray().length) return fail(404, "找不到這把金鑰");
    const active = bool(body, "active");
    if (active !== undefined) this.sql.exec("UPDATE agent_keys SET active = ? WHERE id = ?", active ? 1 : 0, id);
    return ok({ id });
  }

  async agentAuth(key: string): Promise<AgentIdentity | null> {
    if (!key) return null;
    const row = this.sql
      .exec<{ id: string; name: string }>("SELECT id, name FROM agent_keys WHERE hash = ? AND active = 1", await sha256Hex(key))
      .toArray()[0];
    if (!row) return null;
    this.sql.exec("UPDATE agent_keys SET last_used_at = ? WHERE id = ?", Date.now(), row.id);
    return { id: row.id, name: row.name };
  }

  // agent 能呼叫的工具只有這些；其他名稱一律拒絕
  agentTool(agent: AgentIdentity, name: string, args: Body): Result {
    const id = typeof args.id === "string" ? args.id : "";
    switch (name) {
      case "list_groups":
        return ok({ groups: this.activeGroups() });
      case "list_boards":
        return ok({ boards: this.boards() });
      case "create_board":
        return this.createBoard(args);
      case "update_board":
        return this.updateBoard(id, args);
      case "delete_board":
        return this.deleteBoard(id);
      case "create_card":
        return this.createCard(`agent：${agent.name}`, args);
      case "update_card":
        return this.updateCard(id, args);
      case "delete_card":
        return this.deleteCard(id);
      default:
        return fail(404, `沒有這個工具：${name}`);
    }
  }
}
