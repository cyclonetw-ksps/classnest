// 學生平板與圖卡密碼登入。
//
// 權限邊界：
// - 只有老師設定過的「學生平板」能列出名單（組別、顯示名）與讓學生登入；憑證只存雜湊。
// - 學生登入的憑證要和登入時那台學生平板一起出示才有效；老師 API 一律不認這兩種憑證。
// - 共用平板每次登入 10 分鐘就失效；個人平板一直記住，換另一位學生登入時前一位登出。
// - 同一位學生連錯幾次就暫停一段時間；老師重新產生圖卡密碼會解除。
import { CARD_COUNT, isCardSequence, PASSWORD_LENGTH } from "../shared/cards";
import { LIMITS, type Device, type DeviceMode, type LoginCards } from "../shared/types";
import { fail, InputError, newId, newSessionToken, ok, sha256Hex, text, type Body, type Result } from "./validate";

// 瀏覽器最多記住 400 天；個人平板的學生登入與學生平板本身都用這個長度
export const LONG_COOKIE_S = 400 * 24 * 60 * 60;

export interface DeviceAuth {
  id: string;
  mode: DeviceMode;
}

function randomCards(): number[] {
  const deck = Array.from({ length: CARD_COUNT }, (_, i) => i);
  const picked: number[] = [];
  while (picked.length < PASSWORD_LENGTH) {
    // 取 0～255 的亂數，丟掉會造成偏差的尾端
    const [r] = crypto.getRandomValues(new Uint8Array(1));
    if (r >= 256 - (256 % deck.length)) continue;
    picked.push(deck.splice(r % deck.length, 1)[0]);
  }
  return picked;
}

export class KioskStore {
  constructor(
    private sql: SqlStorage,
    private storage: DurableObjectStorage,
  ) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, mode TEXT NOT NULL,
        created_by TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER);
      CREATE TABLE IF NOT EXISTS student_cards (
        student_id TEXT PRIMARY KEY, cards TEXT NOT NULL, fails INTEGER NOT NULL, locked_until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS student_sessions (
        hash TEXT PRIMARY KEY, student_id TEXT NOT NULL, device_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
    `);
  }

  /* ---------- 老師：學生平板 ---------- */

  devices(): Device[] {
    const now = Date.now();
    return this.sql
      .exec<{ id: string; name: string; mode: DeviceMode; created_at: number; last_seen_at: number | null; student_name: string | null }>(
        `SELECT d.id, d.name, d.mode, d.created_at, d.last_seen_at,
           (SELECT s.display_name FROM student_sessions ss JOIN students s ON s.id = ss.student_id
            WHERE ss.device_id = d.id AND ss.expires_at > ? AND d.mode = 'personal' ORDER BY ss.expires_at DESC LIMIT 1) AS student_name
         FROM devices d ORDER BY d.created_at, d.rowid`,
        now,
      )
      .toArray()
      .map((d) => ({ id: d.id, name: d.name, mode: d.mode, createdAt: d.created_at, lastSeenAt: d.last_seen_at, studentName: d.student_name }));
  }

  // 回傳新的學生平板與憑證（憑證只在這一次出現，Worker 放進 cookie，不回給前端）
  async enroll(teacherEmail: string, body: Body): Promise<Result<{ device: Device; token: string }>> {
    const name = text(body, "name", LIMITS.name, { required: true, label: "平板名稱" })!;
    const mode = body.mode;
    if (mode !== "shared" && mode !== "personal") throw new InputError("請選擇共用或個人平板");
    if (this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM devices").one().n >= LIMITS.devices) {
      return fail(400, `最多 ${LIMITS.devices} 台學生平板，請先登出不用的`);
    }
    const token = newSessionToken();
    const id = newId();
    this.sql.exec(
      "INSERT INTO devices (id, hash, name, mode, created_by, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      id,
      await sha256Hex(token),
      name,
      mode,
      teacherEmail,
      Date.now(),
    );
    return ok({ device: this.devices().find((d) => d.id === id)!, token });
  }

  updateDevice(id: string, body: Body): Result {
    if (!this.sql.exec("SELECT 1 FROM devices WHERE id = ?", id).toArray().length) return fail(404, "找不到這台學生平板");
    const name = text(body, "name", LIMITS.name, { required: true, label: "平板名稱" })!;
    this.sql.exec("UPDATE devices SET name = ? WHERE id = ?", name, id);
    return ok({ id });
  }

  // 登出一台學生平板：連同在上面登入的學生一起失效
  deleteDevice(id: string): Result {
    if (!this.sql.exec("SELECT 1 FROM devices WHERE id = ?", id).toArray().length) return fail(404, "找不到這台學生平板");
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM student_sessions WHERE device_id = ?", id);
      this.sql.exec("DELETE FROM devices WHERE id = ?", id);
    });
    return ok({ id });
  }

  /* ---------- 老師：圖卡密碼 ---------- */

  generateCards(studentId: string): Result<{ studentId: string; cards: number[] }> {
    if (!this.sql.exec("SELECT 1 FROM students WHERE id = ?", studentId).toArray().length) return fail(404, "找不到這位學生");
    const cards = randomCards();
    this.sql.exec(
      `INSERT INTO student_cards (student_id, cards, fails, locked_until) VALUES (?, ?, 0, 0)
       ON CONFLICT(student_id) DO UPDATE SET cards = excluded.cards, fails = 0, locked_until = 0`,
      studentId,
      cards.join(","),
    );
    return ok({ studentId, cards });
  }

  withCards(): Set<string> {
    return new Set(this.sql.exec<{ student_id: string }>("SELECT student_id FROM student_cards").toArray().map((r) => r.student_id));
  }

  // 印圖卡密碼：使用中、已有密碼的學生
  loginCards(): LoginCards[] {
    const groups = new Map<string, string[]>();
    for (const m of this.sql.exec<{ student_id: string; group_id: string }>("SELECT student_id, group_id FROM memberships").toArray()) {
      groups.set(m.student_id, [...(groups.get(m.student_id) ?? []), m.group_id]);
    }
    return this.sql
      .exec<{ id: string; display_name: string; cards: string }>(
        `SELECT s.id, s.display_name, c.cards FROM students s JOIN student_cards c ON c.student_id = s.id
         WHERE s.active = 1 ORDER BY s.created_at, s.rowid`,
      )
      .toArray()
      .map((r) => ({ studentId: r.id, displayName: r.display_name, groupIds: groups.get(r.id) ?? [], cards: r.cards.split(",").map(Number) }));
  }

  /* ---------- 學生平板 ---------- */

  async deviceAuth(token: string): Promise<DeviceAuth | null> {
    if (!token) return null;
    const row = this.sql.exec<{ id: string; mode: DeviceMode }>("SELECT id, mode FROM devices WHERE hash = ?", await sha256Hex(token)).toArray()[0];
    if (!row) return null;
    this.sql.exec("UPDATE devices SET last_seen_at = ? WHERE id = ?", Date.now(), row.id);
    return { id: row.id, mode: row.mode };
  }

  // 成功時回傳學生憑證與 cookie 要記住多久（秒）
  async login(device: DeviceAuth, body: Body): Promise<Result<{ token: string; maxAge: number }>> {
    if (!isCardSequence(body.cards)) return fail(400, `要依序點 ${PASSWORD_LENGTH} 張不一樣的圖卡`);
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const now = Date.now();
    const row = this.sql
      .exec<{ active: number; cards: string | null; fails: number | null; locked_until: number | null }>(
        `SELECT s.active, c.cards, c.fails, c.locked_until FROM students s LEFT JOIN student_cards c ON c.student_id = s.id WHERE s.id = ?`,
        studentId,
      )
      .toArray()[0];
    if (!row || !row.active) return fail(401, "找不到你的名字，請找老師幫忙");
    if (!row.cards) return fail(401, "老師還沒給你圖卡密碼，請找老師");
    if ((row.locked_until ?? 0) > now) return fail(429, "按錯太多次了，休息 5 分鐘再試，或請老師幫忙");
    if (row.cards !== body.cards.join(",")) {
      const fails = (row.fails ?? 0) + 1;
      if (fails >= LIMITS.cardAttempts) {
        this.sql.exec("UPDATE student_cards SET fails = 0, locked_until = ? WHERE student_id = ?", now + LIMITS.cardLockMs, studentId);
      } else {
        this.sql.exec("UPDATE student_cards SET fails = ? WHERE student_id = ?", fails, studentId);
      }
      return fail(401, "圖卡的順序不對，再試一次");
    }
    const personal = device.mode === "personal";
    const token = newSessionToken();
    const hash = await sha256Hex(token);
    this.storage.transactionSync(() => {
      this.sql.exec("UPDATE student_cards SET fails = 0, locked_until = 0 WHERE student_id = ?", studentId);
      this.sql.exec("DELETE FROM student_sessions WHERE expires_at < ?", now);
      // 個人平板只記住一位學生
      if (personal) this.sql.exec("DELETE FROM student_sessions WHERE device_id = ?", device.id);
      this.sql.exec(
        "INSERT INTO student_sessions (hash, student_id, device_id, expires_at) VALUES (?, ?, ?, ?)",
        hash,
        studentId,
        device.id,
        now + (personal ? LONG_COOKIE_S * 1000 : LIMITS.sharedSessionMs),
      );
    });
    return ok({ token, maxAge: personal ? LONG_COOKIE_S : LIMITS.sharedSessionMs / 1000 });
  }

  // 學生憑證要和登入時那台學生平板一起才有效；學生停用或平板被登出就失效
  async studentAuth(device: DeviceAuth, token: string): Promise<string | null> {
    if (!token) return null;
    const row = this.sql
      .exec<{ student_id: string }>(
        `SELECT ss.student_id FROM student_sessions ss JOIN students s ON s.id = ss.student_id
         WHERE ss.hash = ? AND ss.device_id = ? AND ss.expires_at > ? AND s.active = 1`,
        await sha256Hex(token),
        device.id,
        Date.now(),
      )
      .toArray()[0];
    return row?.student_id ?? null;
  }

  async logout(token: string): Promise<void> {
    if (token) this.sql.exec("DELETE FROM student_sessions WHERE hash = ?", await sha256Hex(token));
  }
}
