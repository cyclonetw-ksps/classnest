// 簽到：老師按「開放簽到」開一段時間（預設 10 分鐘），學生在學生平板登入後按「簽到」。
//
// - 同一次開放，一位學生只算一次；老師撤銷後可以再簽。
// - 開放中再按一次只延長時間；關掉再開是新的一次。
// - 紀錄保留 30 天，開放與簽到時順便刪掉更舊的。
// - 名單只有顯示名與時間；停用的學生不列。不開放給 agent。
import { LIMITS, type CheckinView, type StudentView } from "../shared/types";
import { fail, int, newId, ok, type Body, type Result } from "./validate";

// 老師端看得到「最近一次」開放的名單多久（關掉後還能撤銷、核對）
const RECENT_MS = 12 * 60 * 60 * 1000;

type Window = { id: string; opened_at: number; closes_at: number };

export class CheckinStore {
  constructor(private sql: SqlStorage) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS checkin_windows (
        id TEXT PRIMARY KEY, opened_by TEXT NOT NULL, opened_at INTEGER NOT NULL, closes_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY, window_id TEXT NOT NULL, student_id TEXT NOT NULL, at INTEGER NOT NULL,
        device_id TEXT NOT NULL, undone_at INTEGER, undone_by TEXT);
      CREATE INDEX IF NOT EXISTS checkins_window ON checkins (window_id);
    `);
  }

  private openWindow(now = Date.now()): Window | undefined {
    return this.sql
      .exec<Window>("SELECT id, opened_at, closes_at FROM checkin_windows WHERE closes_at > ? ORDER BY opened_at DESC LIMIT 1", now)
      .toArray()[0];
  }

  private prune(now: number): void {
    const before = now - LIMITS.checkinKeepMs;
    this.sql.exec("DELETE FROM checkins WHERE at < ?", before);
    this.sql.exec("DELETE FROM checkin_windows WHERE closes_at < ?", before);
  }

  // 目前開放中、或最近一次（12 小時內）的開放與已簽到的學生
  view(): CheckinView {
    const now = Date.now();
    const w =
      this.openWindow(now) ??
      this.sql
        .exec<Window>("SELECT id, opened_at, closes_at FROM checkin_windows WHERE closes_at > ? ORDER BY opened_at DESC LIMIT 1", now - RECENT_MS)
        .toArray()[0];
    if (!w) return { window: null, checkins: [] };
    const checkins = this.sql
      .exec<{ id: string; student_id: string; display_name: string; at: number }>(
        `SELECT c.id, c.student_id, s.display_name, c.at FROM checkins c JOIN students s ON s.id = c.student_id
         WHERE c.window_id = ? AND c.undone_at IS NULL AND s.active = 1 ORDER BY c.at, c.rowid`,
        w.id,
      )
      .toArray()
      .map((c) => ({ id: c.id, studentId: c.student_id, displayName: c.display_name, at: c.at }));
    return { window: { id: w.id, openedAt: w.opened_at, closesAt: w.closes_at, open: w.closes_at > now }, checkins };
  }

  open(teacherEmail: string, body: Body): Result<CheckinView> {
    const minutes = int(body, "minutes", 1, LIMITS.checkinMaxMinutes, { label: "開放分鐘數" }) ?? LIMITS.checkinMinutes;
    const now = Date.now();
    this.prune(now);
    const current = this.openWindow(now);
    if (current) {
      this.sql.exec("UPDATE checkin_windows SET closes_at = ? WHERE id = ?", now + minutes * 60_000, current.id);
    } else {
      this.sql.exec(
        "INSERT INTO checkin_windows (id, opened_by, opened_at, closes_at) VALUES (?, ?, ?, ?)",
        newId(),
        teacherEmail,
        now,
        now + minutes * 60_000,
      );
    }
    return ok(this.view());
  }

  close(): Result<CheckinView> {
    const now = Date.now();
    const current = this.openWindow(now);
    if (current) this.sql.exec("UPDATE checkin_windows SET closes_at = ? WHERE id = ?", now, current.id);
    return ok(this.view());
  }

  undo(teacherEmail: string, id: string): Result {
    const row = this.sql.exec<{ undone_at: number | null }>("SELECT undone_at FROM checkins WHERE id = ?", id).toArray()[0];
    if (!row) return fail(404, "找不到這筆簽到");
    if (row.undone_at !== null) return fail(409, "這筆簽到已經撤銷過了");
    this.sql.exec("UPDATE checkins SET undone_at = ?, undone_by = ? WHERE id = ?", Date.now(), teacherEmail, id);
    return ok({ id });
  }

  /* ---------- 學生 ---------- */

  checkin(studentId: string, deviceId: string): Result<{ at: number }> {
    const now = Date.now();
    const w = this.openWindow(now);
    if (!w) return fail(409, "老師還沒開放簽到，或簽到時間已經過了");
    const done = this.sql
      .exec<{ at: number }>("SELECT at FROM checkins WHERE window_id = ? AND student_id = ? AND undone_at IS NULL", w.id, studentId)
      .toArray()[0];
    if (done) return ok({ at: done.at });
    this.prune(now);
    this.sql.exec(
      "INSERT INTO checkins (id, window_id, student_id, at, device_id) VALUES (?, ?, ?, ?, ?)",
      newId(),
      w.id,
      studentId,
      now,
      deviceId,
    );
    return ok({ at: now });
  }

  forStudent(studentId: string): StudentView["checkin"] {
    const w = this.openWindow();
    if (!w) return { open: false, closesAt: null, checkedIn: false };
    const checkedIn =
      this.sql.exec("SELECT 1 FROM checkins WHERE window_id = ? AND student_id = ? AND undone_at IS NULL", w.id, studentId).toArray().length > 0;
    return { open: true, closesAt: w.closes_at, checkedIn };
  }
}
