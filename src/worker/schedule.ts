// 課表與每週計畫：節次時間、固定週課表、每週各節的內容與作業、臨時換課與停課。
// 資料和班級其他資料放在同一個 Durable Object 的 SQLite。
//
// 權限邊界：
// - 老師（Google 登入）可以做全部的事。
// - agent 金鑰只能讀節次、固定課表與某一週，並寫每週各節的內容、作業、要帶的東西（setWeekPlan）；
//   改節次、改固定課表、換課、停課都只有老師能做（見 BoardStore.agentTool 的白名單）。
import { formatClock, parseClock } from "../shared/clock";
import { LIMITS, type Lesson, type Period, type Slot, type WeekView } from "../shared/types";
import { addDays, isWeekStart, weekDates, WEEKDAYS } from "../shared/week";
import { fail, InputError, int, newId, ok, text, type Body, type Result } from "./validate";

type LessonRow = {
  week_start: string;
  weekday: number;
  period_id: string;
  content: string;
  homework: string;
  bring: string;
  changed: number;
  group_id: string | null;
  subject: string;
  cancelled: number;
  note: string;
  updated_by: string;
  updated_at: number;
};

type LessonFields = Pick<LessonRow, "content" | "homework" | "bring" | "changed" | "group_id" | "subject" | "cancelled" | "note">;

const EMPTY: LessonFields = { content: "", homework: "", bring: "", changed: 0, group_id: null, subject: "", cancelled: 0, note: "" };

function clockField(body: Body, key: string, label: string): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  const t = typeof v === "string" ? parseClock(v) : null;
  if (!t) throw new InputError(`${label}格式要是 HH:MM，例如 08:40`);
  return formatClock(t);
}

function weekStart(value: unknown): string {
  if (!isWeekStart(value)) throw new InputError("週的日期要是那一週週一的 YYYY-MM-DD");
  return value as string;
}

function weekday(body: Body): number {
  return int(body, "weekday", 1, WEEKDAYS.length, { required: true, label: "星期（1 是週一，5 是週五）" })!;
}

export class ScheduleStore {
  constructor(
    private sql: SqlStorage,
    private storage: DurableObjectStorage,
  ) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS periods (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, start TEXT NOT NULL, end_at TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS slots (
        weekday INTEGER NOT NULL, period_id TEXT NOT NULL, group_id TEXT, subject TEXT NOT NULL, bring TEXT NOT NULL,
        PRIMARY KEY (weekday, period_id));
      CREATE TABLE IF NOT EXISTS lessons (
        week_start TEXT NOT NULL, weekday INTEGER NOT NULL, period_id TEXT NOT NULL,
        content TEXT NOT NULL, homework TEXT NOT NULL, bring TEXT NOT NULL,
        changed INTEGER NOT NULL, group_id TEXT, subject TEXT NOT NULL,
        cancelled INTEGER NOT NULL, note TEXT NOT NULL,
        updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (week_start, weekday, period_id));
    `);
  }

  /* ---------- 小工具 ---------- */

  private periodExists(id: string): boolean {
    return this.sql.exec("SELECT 1 FROM periods WHERE id = ?", id).toArray().length > 0;
  }

  private checkGroup(groupId: unknown): string | null {
    if (groupId === undefined || groupId === null || groupId === "") return null;
    if (typeof groupId !== "string" || !this.sql.exec("SELECT 1 FROM class_groups WHERE id = ?", groupId).toArray().length) {
      throw new InputError("指定的組別不存在");
    }
    return groupId;
  }

  private checkOverlap(start: string, end: string, exceptId: string | null): void {
    if (end <= start) throw new InputError("結束時刻要晚於開始時刻");
    // HH:MM 補零後字串比較就是時間先後；相接（上一節的結束等於下一節的開始）不算重疊
    const clash = this.periods().find((p) => p.id !== exceptId && start < p.end && p.start < end);
    if (clash) throw new InputError(`和「${clash.label}」（${clash.start}–${clash.end}）的時間重疊`);
  }

  /* ---------- 節次 ---------- */

  periods(): Period[] {
    return this.sql
      .exec<{ id: string; label: string; start: string; end_at: string }>("SELECT id, label, start, end_at FROM periods ORDER BY start, created_at")
      .toArray()
      .map((r) => ({ id: r.id, label: r.label, start: r.start, end: r.end_at }));
  }

  createPeriod(body: Body): Result<Period> {
    const label = text(body, "label", LIMITS.periodLabel, { required: true, label: "節次名稱" })!;
    const start = clockField(body, "start", "開始時刻");
    const end = clockField(body, "end", "結束時刻");
    if (!start || !end) return fail(400, "請填寫開始與結束時刻");
    this.checkOverlap(start, end, null);
    if (this.periods().length >= LIMITS.periods) return fail(400, `最多 ${LIMITS.periods} 節`);
    const id = newId();
    this.sql.exec("INSERT INTO periods (id, label, start, end_at, created_at) VALUES (?, ?, ?, ?, ?)", id, label, start, end, Date.now());
    return ok({ id, label, start, end });
  }

  updatePeriod(id: string, body: Body): Result<Period> {
    const current = this.periods().find((p) => p.id === id);
    if (!current) return fail(404, "找不到這一節");
    const label = text(body, "label", LIMITS.periodLabel, { label: "節次名稱" });
    if (label !== undefined && !label) return fail(400, "請填寫節次名稱");
    const next = {
      id,
      label: label ?? current.label,
      start: clockField(body, "start", "開始時刻") ?? current.start,
      end: clockField(body, "end", "結束時刻") ?? current.end,
    };
    this.checkOverlap(next.start, next.end, id);
    this.sql.exec("UPDATE periods SET label = ?, start = ?, end_at = ? WHERE id = ?", next.label, next.start, next.end, id);
    return ok(next);
  }

  // 固定課表跟著刪；各週已填的內容留在資料庫但不再顯示（不刪老師寫過的東西）
  deletePeriod(id: string): Result<{ id: string }> {
    if (!this.periodExists(id)) return fail(404, "找不到這一節");
    this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM slots WHERE period_id = ?", id);
      this.sql.exec("DELETE FROM periods WHERE id = ?", id);
    });
    return ok({ id });
  }

  /* ---------- 固定週課表 ---------- */

  slots(): Slot[] {
    return this.sql
      .exec<{ weekday: number; period_id: string; group_id: string | null; subject: string; bring: string }>(
        "SELECT weekday, period_id, group_id, subject, bring FROM slots ORDER BY weekday",
      )
      .toArray()
      .map((r) => ({ weekday: r.weekday, periodId: r.period_id, groupId: r.group_id, subject: r.subject, bring: r.bring }));
  }

  // 科目空白代表清掉這一格
  setSlot(body: Body): Result<Slot | { cleared: true }> {
    const day = weekday(body);
    const periodId = text(body, "periodId", 40, { required: true, label: "節次" })!;
    const subject = text(body, "subject", LIMITS.subject, { label: "科目" }) ?? "";
    const bring = text(body, "bring", LIMITS.bring, { label: "要帶的東西" }) ?? "";
    const groupId = this.checkGroup(body.groupId);
    if (!this.periodExists(periodId)) return fail(404, "找不到這一節");
    if (!subject) {
      this.sql.exec("DELETE FROM slots WHERE weekday = ? AND period_id = ?", day, periodId);
      return ok({ cleared: true as const });
    }
    this.sql.exec(
      `INSERT INTO slots (weekday, period_id, group_id, subject, bring) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(weekday, period_id) DO UPDATE SET group_id = excluded.group_id, subject = excluded.subject, bring = excluded.bring`,
      day,
      periodId,
      groupId,
      subject,
      bring,
    );
    return ok({ weekday: day, periodId, groupId, subject, bring });
  }

  /* ---------- 每週計畫 ---------- */

  private rows(week: string): Map<string, LessonRow> {
    const map = new Map<string, LessonRow>();
    for (const r of this.sql.exec<LessonRow>("SELECT * FROM lessons WHERE week_start = ?", week).toArray()) map.set(`${r.weekday}:${r.period_id}`, r);
    return map;
  }

  week(rawWeek: unknown): Result<WeekView> {
    const week = weekStart(rawWeek);
    const periods = this.periods();
    const slots = new Map(this.slots().map((s) => [`${s.weekday}:${s.periodId}`, s]));
    const rows = this.rows(week);
    const days = weekDates(week);
    const lessons: Lesson[] = [];
    for (const d of days) {
      for (const p of periods) {
        const key = `${d.weekday}:${p.id}`;
        const slot = slots.get(key);
        const row = rows.get(key);
        const changed = !!row?.changed;
        lessons.push({
          weekday: d.weekday,
          date: d.date,
          periodId: p.id,
          groupId: changed ? row!.group_id : (slot?.groupId ?? null),
          subject: changed ? row!.subject : (slot?.subject ?? ""),
          base: slot ? { groupId: slot.groupId, subject: slot.subject, bring: slot.bring } : null,
          changed,
          cancelled: !!row?.cancelled,
          note: row?.note ?? "",
          content: row?.content ?? "",
          homework: row?.homework ?? "",
          bring: row?.bring || slot?.bring || "",
          ownBring: row?.bring ?? "",
          updatedBy: row?.updated_by ?? "",
          updatedAt: row?.updated_at ?? null,
        });
      }
    }
    return ok({ weekStart: week, days, periods, lessons });
  }

  // 寫入一格；全部欄位都空了就刪掉這一列
  private save(week: string, day: number, periodId: string, fields: LessonFields, actor: string): void {
    const empty = !fields.content && !fields.homework && !fields.bring && !fields.changed && !fields.cancelled;
    if (empty) {
      this.sql.exec("DELETE FROM lessons WHERE week_start = ? AND weekday = ? AND period_id = ?", week, day, periodId);
      return;
    }
    this.sql.exec(
      `INSERT INTO lessons (week_start, weekday, period_id, content, homework, bring, changed, group_id, subject, cancelled, note, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(week_start, weekday, period_id) DO UPDATE SET
         content = excluded.content, homework = excluded.homework, bring = excluded.bring, changed = excluded.changed,
         group_id = excluded.group_id, subject = excluded.subject, cancelled = excluded.cancelled, note = excluded.note,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      week,
      day,
      periodId,
      fields.content,
      fields.homework,
      fields.bring,
      fields.changed,
      fields.group_id,
      fields.subject,
      fields.cancelled,
      fields.note,
      actor,
      Date.now(),
    );
  }

  private current(week: string, day: number, periodId: string): LessonFields {
    const row = this.sql
      .exec<LessonRow>("SELECT * FROM lessons WHERE week_start = ? AND weekday = ? AND period_id = ?", week, day, periodId)
      .toArray()[0];
    return row ? { ...row } : { ...EMPTY };
  }

  // 內容、作業、要帶的東西：只改有給的欄位
  private contentFields(body: Body) {
    return {
      content: text(body, "content", LIMITS.lessonContent, { label: "教學內容" }),
      homework: text(body, "homework", LIMITS.homework, { label: "作業" }),
      bring: text(body, "bring", LIMITS.bring, { label: "要帶的東西" }),
    };
  }

  setLesson(actor: string, body: Body): Result<{ weekStart: string; weekday: number; periodId: string }> {
    const week = weekStart(body.weekStart);
    const day = weekday(body);
    const periodId = text(body, "periodId", 40, { required: true, label: "節次" })!;
    const c = this.contentFields(body);
    const note = text(body, "note", LIMITS.lessonNote, { label: "停課原因" });
    const cancelled = body.cancelled;
    if (cancelled !== undefined && typeof cancelled !== "boolean") throw new InputError("停課要是 true 或 false");
    let change: { group_id: string | null; subject: string } | null | undefined;
    if (body.change === null) change = null;
    else if (body.change !== undefined) {
      if (typeof body.change !== "object" || Array.isArray(body.change)) throw new InputError("換課格式不正確");
      const ch = body.change as Body;
      const subject = text(ch, "subject", LIMITS.subject, { required: true, label: "換課後的科目" })!;
      change = { group_id: this.checkGroup(ch.groupId), subject };
    }
    if (!this.periodExists(periodId)) return fail(404, "找不到這一節");

    const f = this.current(week, day, periodId);
    if (c.content !== undefined) f.content = c.content;
    if (c.homework !== undefined) f.homework = c.homework;
    if (c.bring !== undefined) f.bring = c.bring;
    if (change === null) Object.assign(f, { changed: 0, group_id: null, subject: "" });
    else if (change) Object.assign(f, { changed: 1, ...change });
    if (cancelled !== undefined) f.cancelled = cancelled ? 1 : 0;
    if (note !== undefined) f.note = note;
    if (!f.cancelled) f.note = "";
    this.save(week, day, periodId, f, actor);
    return ok({ weekStart: week, weekday: day, periodId });
  }

  // 上一週有內容、作業或要帶的東西的格子，複製到這週還空著的格子；換課與停課不複製
  copyLastWeek(rawWeek: unknown, actor: string): Result<{ copied: number }> {
    const week = weekStart(rawWeek);
    const target = this.rows(week);
    const periods = new Set(this.periods().map((p) => p.id));
    let copied = 0;
    this.storage.transactionSync(() => {
      for (const src of this.rows(addDays(week, -7)).values()) {
        if (!periods.has(src.period_id) || (!src.content && !src.homework && !src.bring)) continue;
        const key = `${src.weekday}:${src.period_id}`;
        const t = target.get(key);
        if (t && (t.content || t.homework || t.bring)) continue;
        const f: LessonFields = t ? { ...t } : { ...EMPTY };
        Object.assign(f, { content: src.content, homework: src.homework, bring: src.bring });
        this.save(week, src.weekday, src.period_id, f, actor);
        copied++;
      }
    });
    return ok({ copied });
  }

  // agent 一次填整週：先全部檢查，有一格錯就整批不寫；只收內容、作業、要帶的東西
  setWeekPlan(actor: string, args: Body): Result<{ weekStart: string; saved: number }> {
    const week = weekStart(args.weekStart);
    const list = args.lessons;
    const max = WEEKDAYS.length * LIMITS.periods;
    if (!Array.isArray(list) || list.length === 0 || list.length > max) throw new InputError(`lessons 要是 1 到 ${max} 格的陣列`);
    const seen = new Set<string>();
    const plan = list.map((raw, i) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new InputError(`第 ${i + 1} 格格式不正確`);
      const item = raw as Body;
      try {
        const day = weekday(item);
        const periodId = text(item, "periodId", 40, { required: true, label: "節次" })!;
        if (!this.periodExists(periodId)) throw new InputError("找不到這一節（先用 get_timetable 查節次代號）");
        const key = `${day}:${periodId}`;
        if (seen.has(key)) throw new InputError("同一週同一節出現兩次");
        seen.add(key);
        return { day, periodId, ...this.contentFields(item) };
      } catch (err) {
        if (err instanceof InputError) throw new InputError(`第 ${i + 1} 格：${err.message}`);
        throw err;
      }
    });
    this.storage.transactionSync(() => {
      for (const p of plan) {
        const f = this.current(week, p.day, p.periodId);
        if (p.content !== undefined) f.content = p.content;
        if (p.homework !== undefined) f.homework = p.homework;
        if (p.bring !== undefined) f.bring = p.bring;
        this.save(week, p.day, p.periodId, f, actor);
      }
    });
    return ok({ weekStart: week, saved: plan.length });
  }
}
