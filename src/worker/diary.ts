// 聯絡簿：一天一組一則（作業、要帶的東西、備註），可以對組裡個別學生加註。
// 資料和班級其他資料放在同一個 Durable Object 的 SQLite。
//
// 權限邊界：
// - 老師（Google 登入）可以寫、存草稿、發送、收回。
// - 分享頁只看得到已發送的作業、要帶、備註；個別加註與是誰寫的都不給。
// - agent 金鑰只能讀某一天各組的聯絡簿（不含個別加註與學生）並草擬；已發送的不能改，也不能發送。
import { suggestDiary } from "../shared/diary";
import { LIMITS, type DiaryDay, type DiaryEntry, type DiaryStatus, type Lesson, type PublicDiary, type StudentView } from "../shared/types";
import { mondayOf, parseDate } from "../shared/week";
import { fail, InputError, ok, text, type Body, type Result } from "./validate";

type Row = {
  date: string;
  group_id: string;
  homework: string;
  bring: string;
  note: string;
  status: "draft" | "sent";
  updated_by: string;
  updated_at: number;
  sent_at: number | null;
};

type Fields = { homework: string; bring: string; note: string };

function date(value: unknown): string {
  const d = parseDate(value);
  if (!d) throw new InputError("日期要是 YYYY-MM-DD，例如 2026-12-02");
  return d;
}

function fields(body: Body, keepFrom?: Fields): Fields {
  const pick = (key: keyof Fields, max: number, label: string) => text(body, key, max, { label }) ?? keepFrom?.[key] ?? "";
  return {
    homework: pick("homework", LIMITS.diaryHomework, "作業"),
    bring: pick("bring", LIMITS.diaryBring, "要帶的東西"),
    note: pick("note", LIMITS.diaryNote, "備註"),
  };
}

const isEmpty = (f: Fields) => !f.homework && !f.bring && !f.note;

export class DiaryStore {
  constructor(
    private sql: SqlStorage,
    private storage: DurableObjectStorage,
    // 某一天依節次排好的課（已套用換課與停課），用來帶入建議
    private lessonsOn: (date: string) => Lesson[],
  ) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS diary (
        date TEXT NOT NULL, group_id TEXT NOT NULL,
        homework TEXT NOT NULL, bring TEXT NOT NULL, note TEXT NOT NULL,
        status TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL, sent_at INTEGER,
        PRIMARY KEY (date, group_id));
      CREATE TABLE IF NOT EXISTS diary_notes (
        date TEXT NOT NULL, group_id TEXT NOT NULL, student_id TEXT NOT NULL, text TEXT NOT NULL,
        PRIMARY KEY (date, group_id, student_id));
    `);
  }

  /* ---------- 小工具 ---------- */

  private activeGroups(): { id: string; name: string }[] {
    return this.sql.exec<{ id: string; name: string }>("SELECT id, name FROM class_groups WHERE active = 1 ORDER BY created_at, rowid").toArray();
  }

  private checkGroup(value: unknown): string {
    if (typeof value !== "string" || !this.sql.exec("SELECT 1 FROM class_groups WHERE id = ?", value).toArray().length) {
      throw new InputError("指定的組別不存在");
    }
    return value;
  }

  private row(d: string, groupId: string): Row | undefined {
    return this.sql.exec<Row>("SELECT * FROM diary WHERE date = ? AND group_id = ?", d, groupId).toArray()[0];
  }

  // 只算現在還在這一組的學生；離組學生的舊加註不顯示、不複製，也不算「有加註」
  private notes(d: string, groupId: string): { studentId: string; text: string }[] {
    return this.sql
      .exec<{ student_id: string; text: string }>(
        `SELECT n.student_id, n.text FROM diary_notes n
         JOIN students s ON s.id = n.student_id
         JOIN memberships m ON m.student_id = n.student_id AND m.group_id = n.group_id
         WHERE n.date = ? AND n.group_id = ? ORDER BY s.created_at, s.rowid`,
        d,
        groupId,
      )
      .toArray()
      .map((r) => ({ studentId: r.student_id, text: r.text }));
  }

  private entry(d: string, groupId: string, lessons: Lesson[]): DiaryEntry {
    const r = this.row(d, groupId);
    return {
      date: d,
      groupId,
      status: (r?.status ?? "empty") as DiaryStatus,
      homework: r?.homework ?? "",
      bring: r?.bring ?? "",
      note: r?.note ?? "",
      suggested: suggestDiary(lessons, groupId),
      studentNotes: this.notes(d, groupId),
      updatedBy: r?.updated_by ?? "",
      updatedAt: r?.updated_at ?? null,
      sentAt: r?.sent_at ?? null,
    };
  }

  // 寫入（或全部清空時刪掉）一則；個別加註另外處理。
  // 刪掉時一併清掉這一則剩下的加註（只會是離組學生的舊加註，免得學生回到這一組時又冒出來）
  private write(d: string, groupId: string, f: Fields, status: "draft" | "sent", actor: string, hasNotes: boolean): void {
    if (isEmpty(f) && !hasNotes) {
      this.sql.exec("DELETE FROM diary WHERE date = ? AND group_id = ?", d, groupId);
      this.sql.exec("DELETE FROM diary_notes WHERE date = ? AND group_id = ?", d, groupId);
      return;
    }
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO diary (date, group_id, homework, bring, note, status, updated_by, updated_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, group_id) DO UPDATE SET homework = excluded.homework, bring = excluded.bring, note = excluded.note,
         status = excluded.status, updated_by = excluded.updated_by, updated_at = excluded.updated_at, sent_at = excluded.sent_at`,
      d,
      groupId,
      f.homework,
      f.bring,
      f.note,
      status,
      actor,
      now,
      status === "sent" ? now : null,
    );
  }

  /* ---------- 老師 ---------- */

  // 每個使用中的組各一則；還沒寫的只有從課表帶入的建議
  day(rawDate: unknown): Result<DiaryDay> {
    const d = date(rawDate);
    const lessons = this.lessonsOn(d);
    return ok({ date: d, entries: this.activeGroups().map((g) => this.entry(d, g.id, lessons)) });
  }

  save(actor: string, body: Body): Result<DiaryEntry> {
    const d = date(body.date);
    const groupId = this.checkGroup(body.groupId);
    const status = body.status;
    if (status !== "draft" && status !== "sent") throw new InputError("狀態要是 draft（草稿）或 sent（發送）");
    const f = fields(body);
    if (status === "sent" && isEmpty(f)) return fail(400, "聯絡簿是空的，寫了作業、要帶的東西或備註才能發送");

    // 個別加註：寫內容時學生要在這一組；空白代表刪掉（離組學生的舊加註也能這樣清掉）；沒給 studentNotes 就不動
    let notes: { studentId: string; text: string }[] | undefined;
    if (body.studentNotes !== undefined) {
      if (!Array.isArray(body.studentNotes) || body.studentNotes.length > LIMITS.students) throw new InputError("個別加註格式不正確");
      notes = body.studentNotes.map((n) => {
        if (!n || typeof n !== "object") throw new InputError("個別加註格式不正確");
        const item = n as Body;
        const studentId = typeof item.studentId === "string" ? item.studentId : "";
        const note = text(item, "text", LIMITS.studentNote, { label: "個別加註" }) ?? "";
        const member = this.sql.exec("SELECT 1 FROM memberships WHERE student_id = ? AND group_id = ?", studentId, groupId).toArray().length;
        if (note && !member) throw new InputError("只能替這一組的學生加註");
        return { studentId, text: note };
      });
    }

    this.storage.transactionSync(() => {
      if (notes) {
        for (const n of notes) {
          if (n.text) {
            this.sql.exec(
              `INSERT INTO diary_notes (date, group_id, student_id, text) VALUES (?, ?, ?, ?)
               ON CONFLICT(date, group_id, student_id) DO UPDATE SET text = excluded.text`,
              d,
              groupId,
              n.studentId,
              n.text,
            );
          } else {
            this.sql.exec("DELETE FROM diary_notes WHERE date = ? AND group_id = ? AND student_id = ?", d, groupId, n.studentId);
          }
        }
      }
      const hasNotes = this.notes(d, groupId).length > 0;
      this.write(d, groupId, f, status, actor, hasNotes);
    });
    return ok(this.entry(d, groupId, this.lessonsOn(d)));
  }

  /* ---------- 分享頁 ---------- */

  // 已發送的；有選組就只看那一組。取最近幾個有發送的日期，新的在前
  published(group: string): PublicDiary[] {
    // 只看使用中的組；先找最近幾個有發送的日期，再讀那幾天的內容（不把整學期的資料都讀出來）
    const scope = `FROM diary d JOIN class_groups g ON g.id = d.group_id WHERE d.status = 'sent' AND g.active = 1${group ? " AND d.group_id = ?" : ""}`;
    const args = group ? [group] : [];
    const dates = this.sql
      .exec<{ date: string }>(`SELECT DISTINCT d.date AS date ${scope} ORDER BY d.date DESC LIMIT ${LIMITS.publicDiaryDays}`, ...args)
      .toArray()
      .map((r) => r.date);
    if (!dates.length) return [];
    return this.sql
      .exec<Row>(
        `SELECT d.* ${scope} AND d.date IN (${dates.map(() => "?").join(", ")}) ORDER BY d.date DESC, g.created_at, g.rowid`,
        ...args,
        ...dates,
      )
      .toArray()
      .map((r) => ({ date: r.date, groupId: r.group_id, homework: r.homework, bring: r.bring, note: r.note }));
  }

  // 有已發送聯絡簿的組（分享頁的組別切換要列出它們）
  publishedGroups(): string[] {
    return this.sql.exec<{ group_id: string }>("SELECT DISTINCT group_id FROM diary WHERE status = 'sent'").toArray().map((r) => r.group_id);
  }

  /* ---------- 學生頁 ---------- */

  // 學生所屬的使用中組別，各取最近一次已發送的一則；個別加註只給這位學生自己的
  forStudent(studentId: string): Omit<StudentView["diary"][number], "color">[] {
    return this.sql
      .exec<Row & { group_name: string; my_note: string | null }>(
        `SELECT d.*, g.name AS group_name, n.text AS my_note
         FROM memberships m JOIN class_groups g ON g.id = m.group_id AND g.active = 1
         JOIN diary d ON d.group_id = m.group_id AND d.status = 'sent'
           AND d.date = (SELECT MAX(x.date) FROM diary x WHERE x.group_id = m.group_id AND x.status = 'sent')
         LEFT JOIN diary_notes n ON n.date = d.date AND n.group_id = d.group_id AND n.student_id = m.student_id
         WHERE m.student_id = ? ORDER BY d.date DESC, g.created_at, g.rowid`,
        studentId,
      )
      .toArray()
      .map((r) => ({
        date: r.date,
        groupId: r.group_id,
        groupName: r.group_name,
        homework: r.homework,
        bring: r.bring,
        note: r.note,
        myNote: r.my_note ?? "",
      }));
  }

  /* ---------- agent ---------- */

  // 不含個別加註；老師的信箱只標「老師」
  agentDay(rawDate: unknown): Result {
    const d = date(rawDate);
    const lessons = this.lessonsOn(d);
    const entries = this.activeGroups().map((g) => {
      const { studentNotes: _private, ...e } = this.entry(d, g.id, lessons);
      return { ...e, groupName: g.name, updatedBy: !e.updatedBy || e.updatedBy.startsWith("agent：") ? e.updatedBy : "老師" };
    });
    return ok({ date: d, entries });
  }

  // 只會存成草稿；沒給的欄位不變；已發送的不能改
  agentDraft(actor: string, args: Body): Result {
    const d = date(args.date);
    const groupId = this.checkGroup(args.groupId);
    const r = this.row(d, groupId);
    if (r?.status === "sent") return fail(409, "這則聯絡簿老師已經發送，agent 不能修改；請老師收回成草稿後再草擬");
    const f = fields(args, r);
    this.write(d, groupId, f, "draft", actor, this.notes(d, groupId).length > 0);
    const { studentNotes: _private, ...e } = this.entry(d, groupId, this.lessonsOn(d));
    return ok(e);
  }
}

export const lessonsOnFrom = (week: (monday: string) => Result<{ lessons: Lesson[] }>) => (d: string) => {
  const w = week(mondayOf(d));
  return w.ok ? w.value.lessons.filter((l) => l.date === d) : [];
};
