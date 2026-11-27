import { DurableObject } from "cloudflare:workers";
import {
  LIMITS,
  type ClassState,
  type Group,
  type KioskRoster,
  type StudentView,
  type PointEvent,
  type Reason,
  type Reward,
  type Student,
  type Teacher,
} from "../shared/types";
import type { Env } from "./env";
import { BoardStore, type AgentIdentity } from "./boards";
import { CheckinStore } from "./checkin";
import { DiaryStore, lessonsOnFrom } from "./diary";
import { KioskStore, type DeviceAuth } from "./kiosk";
import { ScheduleStore } from "./schedule";
import { bool, fail, idList, InputError, int, newId, newSessionToken, ok, sha256Hex, text, type Body, type Result } from "./validate";

// 一套部署只有一個班級，全部資料放在這一個 Durable Object 的 SQLite 裡。
// 所有權限與內容檢查都在這裡做；Worker 只負責驗證 Google 身分與路由。

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TITLE = "我們的班級";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Me {
  email: string;
  name: string;
}

// 執行一個操作，把結果或輸入錯誤轉成 { status, json }
async function reply(run: () => Result | Promise<Result>): Promise<{ status: number; json: string }> {
  let result: Result;
  try {
    result = await run();
  } catch (err) {
    if (!(err instanceof InputError)) throw err;
    result = fail(400, err.message);
  }
  const data = result.ok ? result.value : { error: result.error };
  return { status: result.ok ? 200 : result.status, json: JSON.stringify(data) };
}

export class ClassroomDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private board: BoardStore;
  private schedule: ScheduleStore;
  private diary: DiaryStore;
  private kiosk: KioskStore;
  private checkins: CheckinStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS teachers (
        email TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL,
        added_by TEXT NOT NULL, added_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS class_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY, display_name TEXT NOT NULL, home_class TEXT NOT NULL,
        homeroom_teacher TEXT NOT NULL, active INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS memberships (
        student_id TEXT NOT NULL, group_id TEXT NOT NULL, PRIMARY KEY (student_id, group_id));
      CREATE TABLE IF NOT EXISTS reasons (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, points INTEGER NOT NULL, active INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS point_events (
        id TEXT PRIMARY KEY, student_id TEXT NOT NULL, reason_id TEXT NOT NULL, reason_label TEXT NOT NULL,
        points INTEGER NOT NULL, teacher_email TEXT NOT NULL, created_at INTEGER NOT NULL,
        undone_at INTEGER, undone_by TEXT);
      CREATE INDEX IF NOT EXISTS point_events_student ON point_events (student_id);
      CREATE INDEX IF NOT EXISTS point_events_created ON point_events (created_at);
      CREATE TABLE IF NOT EXISTS rewards (
        id TEXT PRIMARY KEY, threshold INTEGER NOT NULL, title TEXT NOT NULL, active INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS grants (
        reward_id TEXT NOT NULL, student_id TEXT NOT NULL, granted_at INTEGER NOT NULL, granted_by TEXT NOT NULL,
        PRIMARY KEY (reward_id, student_id));
    `);
    this.board = new BoardStore(this.sql, ctx.storage);
    this.schedule = new ScheduleStore(this.sql, ctx.storage);
    this.diary = new DiaryStore(this.sql, ctx.storage, lessonsOnFrom((monday) => this.schedule.week(monday)));
    this.kiosk = new KioskStore(this.sql, ctx.storage);
    this.checkins = new CheckinStore(this.sql);
  }

  /* ---------- 登入與工作階段 ---------- */

  // Google 身分已由 Worker 驗證。只有在老師名單內（或是部署設定的第一位老師）才發工作階段。
  async login(email: string, name: string, firstTeacherEmail: string | undefined): Promise<string | null> {
    const now = Date.now();
    const first = firstTeacherEmail?.trim().toLowerCase();
    const row = this.sql.exec<{ active: number }>("SELECT active FROM teachers WHERE email = ?", email).toArray()[0];
    if (!row) {
      if (!first || email !== first) return null;
      this.sql.exec(
        "INSERT INTO teachers (email, name, active, added_by, added_at) VALUES (?, ?, 1, 'deploy', ?)",
        email,
        name,
        now,
      );
    } else if (!row.active) {
      return null;
    }
    this.sql.exec("UPDATE teachers SET name = ? WHERE email = ?", name, email);
    this.sql.exec("DELETE FROM sessions WHERE expires_at < ?", now);
    const token = newSessionToken();
    this.sql.exec("INSERT INTO sessions (hash, email, expires_at) VALUES (?, ?, ?)", await sha256Hex(token), email, now + SESSION_MS);
    return token;
  }

  async authenticate(token: string): Promise<Me | null> {
    if (!token) return null;
    const row = this.sql
      .exec<{ email: string; name: string }>(
        `SELECT t.email AS email, t.name AS name FROM sessions s JOIN teachers t ON t.email = s.email
         WHERE s.hash = ? AND s.expires_at > ? AND t.active = 1`,
        await sha256Hex(token),
        Date.now(),
      )
      .toArray()[0];
    return row ? { email: row.email, name: row.name } : null;
  }

  async logout(token: string): Promise<void> {
    if (token) this.sql.exec("DELETE FROM sessions WHERE hash = ?", await sha256Hex(token));
  }

  publicTitle(): string {
    return this.setting("title") ?? DEFAULT_TITLE;
  }

  /* ---------- 老師端 API ---------- */

  // 回傳 HTTP 狀態與 JSON 字串；錯誤一律是 { error: 說明 }
  async api(me: Me, method: string, path: string[], body: Body): Promise<{ status: number; json: string }> {
    return reply(() => this.route(me, method, path, body ?? {}));
  }

  /* ---------- 分享頁（不需登入，只有代碼與可選通關碼） ---------- */

  // 老師在這台按「設成學生平板」：登出這台的老師，回傳學生平板憑證給 Worker 放進 cookie
  async enrollDevice(me: Me, teacherToken: string, body: Body): Promise<{ status: number; json: string; token?: string }> {
    let token: string | undefined;
    const r = await reply(async () => {
      const result = await this.kiosk.enroll(me.email, body ?? {});
      if (!result.ok) return result;
      token = result.value.token;
      await this.logout(teacherToken);
      return ok({ device: result.value.device });
    });
    return { ...r, token };
  }

  /* ---------- 學生平板（學生平板憑證；學生登入後再加學生憑證） ---------- */

  async student(
    deviceToken: string,
    studentToken: string,
    method: string,
    path: string[],
    body: Body,
  ): Promise<{ status: number; json: string; login?: { token: string; maxAge: number }; clear?: boolean }> {
    const device = await this.kiosk.deviceAuth(deviceToken);
    if (!device) return { status: 401, json: JSON.stringify({ error: "這台還不是學生平板，請老師用這台登入後在「設定」設定" }) };
    const route = `${method} ${path.join("/")}`;
    if (route === "GET roster") return reply(() => ok(this.roster(device)));
    if (route === "POST login") {
      let login: { token: string; maxAge: number } | undefined;
      const r = await reply(async () => {
        const result = await this.kiosk.login(device, body ?? {});
        if (!result.ok) return result;
        login = result.value;
        return ok({ ok: true });
      });
      return { ...r, login };
    }
    if (route === "POST logout") {
      await this.kiosk.logout(studentToken);
      return { status: 200, json: JSON.stringify({ ok: true }), clear: true };
    }
    const studentId = await this.kiosk.studentAuth(device, studentToken);
    if (!studentId) return { status: 401, json: JSON.stringify({ error: "請先點自己的名字登入" }) };
    if (route === "GET me") return reply(() => ok(this.studentView(device, studentId)));
    if (route === "POST checkin") return reply(() => this.checkins.checkin(studentId, device.id));
    return { status: 404, json: JSON.stringify({ error: "找不到這個功能" }) };
  }

  async publicView(code: string, body: Body): Promise<{ status: number; json: string }> {
    return this.board.publicView(code, body ?? {}, this.diary);
  }

  /* ---------- agent 入口（MCP；用金鑰，不用老師登入） ---------- */

  async agentAuth(key: string): Promise<AgentIdentity | null> {
    return this.board.agentAuth(key);
  }

  // 每次呼叫都重新驗金鑰，停用的金鑰立即失效；最後使用時間已在 agentAuth 記過，這裡不再寫
  async agentTool(key: string, name: string, args: Body): Promise<{ status: number; json: string }> {
    const agent = await this.board.agentAuth(key, false);
    if (!agent) return { status: 401, json: JSON.stringify({ error: "金鑰無效或已停用" }) };
    return reply(() => this.agentCall(agent, name, args ?? {}));
  }

  // agent 能呼叫的工具：課表三個與聯絡簿兩個在這裡，其餘（組別、面板、卡片）在 BoardStore.agentTool；
  // 兩邊都不認得的名稱一律拒絕。換課、停課、改節次與固定課表只有老師能做；聯絡簿 agent 只能草擬，發送只有老師能做。
  private agentCall(agent: AgentIdentity, name: string, args: Body): Result {
    switch (name) {
      case "get_timetable":
        return ok({ periods: this.schedule.periods(), slots: this.schedule.slots(), groups: this.board.activeGroups() });
      case "get_week": {
        // 老師的信箱不給 agent：老師寫的只標「老師」，agent 寫的保留金鑰名稱
        const week = this.schedule.week(args.weekStart);
        if (!week.ok) return week;
        const lessons = week.value.lessons.map((l) => ({ ...l, updatedBy: !l.updatedBy || l.updatedBy.startsWith("agent：") ? l.updatedBy : "老師" }));
        return ok({ ...week.value, lessons });
      }
      case "set_week_plan":
        return this.schedule.setWeekPlan(`agent：${agent.name}`, args);
      case "get_contact_book":
        return this.diary.agentDay(args.date);
      case "draft_contact_book":
        return this.diary.agentDraft(`agent：${agent.name}`, args);
      default:
        return this.board.agentTool(agent, name, args);
    }
  }

  private route(me: Me, method: string, path: string[], body: Body): Result | Promise<Result> {
    const [resource, id, action] = path;
    const key = `${method} ${resource}${id !== undefined ? "/:id" : ""}${action ? `/${action}` : ""}`;
    switch (key) {
      case "GET state":
        return ok(this.state(me));
      case "PUT settings":
        return this.updateSettings(body);
      case "POST teachers":
        return this.inviteTeacher(me, body);
      case "PATCH teachers/:id":
        return this.updateTeacher(me, id, body);
      case "POST groups":
        return this.createGroup(body);
      case "PATCH groups/:id":
        return this.updateGroup(id, body);
      case "POST students":
        return this.createStudent(body);
      case "PATCH students/:id":
        return this.updateStudent(id, body);
      case "POST reasons":
        return this.createReason(body);
      case "PATCH reasons/:id":
        return this.updateReason(id, body);
      case "POST points":
        return this.award(me, body);
      case "POST points/:id/undo":
        return this.undo(me, id);
      case "POST rewards":
        return this.createReward(body);
      case "PATCH rewards/:id":
        return this.updateReward(id, body);
      case "POST rewards/:id/grant":
        return this.grant(me, id, body, true);
      case "POST rewards/:id/ungrant":
        return this.grant(me, id, body, false);
      case "POST boards":
        return this.board.createBoard(body);
      case "PATCH boards/:id":
        return this.board.updateBoard(id, body);
      case "DELETE boards/:id":
        return this.board.deleteBoard(id);
      case "POST cards":
        return this.board.createCard(me.email, body);
      case "PATCH cards/:id":
        return this.board.updateCard(id, body);
      case "DELETE cards/:id":
        return this.board.deleteCard(id);
      case "PUT share":
        return this.board.setPin(body);
      case "POST share/:id":
        return id === "reset" ? this.board.resetShare() : fail(404, "找不到這個功能");
      case "POST agent-keys":
        return this.board.createKey(me.email, body);
      case "PATCH agent-keys/:id":
        return this.board.updateKey(id, body);
      case "POST periods":
        return this.schedule.createPeriod(body);
      case "PATCH periods/:id":
        return this.schedule.updatePeriod(id, body);
      case "DELETE periods/:id":
        return this.schedule.deletePeriod(id);
      case "PUT slots":
        return this.schedule.setSlot(body);
      case "GET week/:id":
        return this.schedule.week(id);
      case "POST week/:id/copy-last":
        return this.schedule.copyLastWeek(id, me.email);
      case "PUT lessons":
        return this.schedule.setLesson(me.email, body);
      case "PATCH devices/:id":
        return this.kiosk.updateDevice(id, body);
      case "DELETE devices/:id":
        return this.kiosk.deleteDevice(id);
      case "POST students/:id/cards":
        return this.kiosk.generateCards(id);
      case "GET checkin":
        return ok(this.checkins.view());
      case "POST checkin/:id":
        return id === "open" ? this.checkins.open(me.email, body) : id === "close" ? this.checkins.close() : fail(404, "找不到這個功能");
      case "POST checkins/:id/undo":
        return this.checkins.undo(me.email, id);
      case "GET login-cards":
        return ok(this.kiosk.loginCards());
      case "GET diary/:id":
        return this.diary.day(id);
      case "PUT diary":
        return this.diary.save(me.email, body);
      default:
        return fail(404, "找不到這個功能");
    }
  }

  private setting(key: string): string | undefined {
    return this.sql.exec<{ value: string }>("SELECT value FROM settings WHERE key = ?", key).toArray()[0]?.value;
  }

  private count(table: string): number {
    return this.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`).one().n;
  }

  private exists(table: string, id: string): boolean {
    return this.sql.exec(`SELECT 1 FROM ${table} WHERE id = ?`, id).toArray().length > 0;
  }

  private updateSettings(body: Body): Result {
    const title = text(body, "title", LIMITS.title, { required: true, label: "網站標題" })!;
    this.sql.exec("INSERT INTO settings (key, value) VALUES ('title', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", title);
    return ok({ title });
  }

  private inviteTeacher(me: Me, body: Body): Result {
    const email = text(body, "email", 120, { required: true, label: "老師信箱" })!.toLowerCase();
    if (!EMAIL_RE.test(email)) return fail(400, "老師信箱格式不正確");
    const existing = this.sql.exec<{ active: number }>("SELECT active FROM teachers WHERE email = ?", email).toArray()[0];
    if (existing) {
      this.sql.exec("UPDATE teachers SET active = 1 WHERE email = ?", email);
    } else {
      if (this.count("teachers") >= LIMITS.teachers) return fail(400, `最多 ${LIMITS.teachers} 位老師`);
      this.sql.exec(
        "INSERT INTO teachers (email, name, active, added_by, added_at) VALUES (?, ?, 1, ?, ?)",
        email,
        email.split("@")[0],
        me.email,
        Date.now(),
      );
    }
    return ok({ email });
  }

  private updateTeacher(me: Me, rawEmail: string, body: Body): Result {
    let email: string;
    try {
      email = decodeURIComponent(rawEmail).toLowerCase();
    } catch {
      return fail(400, "老師信箱格式不正確");
    }
    if (!this.sql.exec("SELECT 1 FROM teachers WHERE email = ?", email).toArray().length) return fail(404, "找不到這位老師");
    const active = bool(body, "active");
    if (active === false) {
      if (email === me.email) return fail(400, "不能停用自己");
      this.sql.exec("UPDATE teachers SET active = 0 WHERE email = ?", email);
      this.sql.exec("DELETE FROM sessions WHERE email = ?", email);
    } else if (active === true) {
      this.sql.exec("UPDATE teachers SET active = 1 WHERE email = ?", email);
    }
    return ok({ email });
  }

  private createGroup(body: Body): Result<Group> {
    const name = text(body, "name", LIMITS.name, { required: true, label: "組名" })!;
    if (this.count("class_groups") >= LIMITS.groups) return fail(400, `最多 ${LIMITS.groups} 個組`);
    const group: Group = { id: newId(), name, active: true };
    this.sql.exec("INSERT INTO class_groups (id, name, active, created_at) VALUES (?, ?, 1, ?)", group.id, name, Date.now());
    return ok(group);
  }

  private updateGroup(id: string, body: Body): Result {
    if (!this.exists("class_groups", id)) return fail(404, "找不到這個組");
    const name = text(body, "name", LIMITS.name, { label: "組名" });
    const active = bool(body, "active");
    if (name !== undefined) {
      if (!name) return fail(400, "請填寫組名");
      this.sql.exec("UPDATE class_groups SET name = ? WHERE id = ?", name, id);
    }
    if (active !== undefined) this.sql.exec("UPDATE class_groups SET active = ? WHERE id = ?", active ? 1 : 0, id);
    return ok({ id });
  }

  private checkGroups(groupIds: string[]): void {
    for (const g of groupIds) {
      if (!this.exists("class_groups", g)) throw new InputError("指定的組別不存在");
    }
  }

  private setMemberships(studentId: string, groupIds: string[]): void {
    this.sql.exec("DELETE FROM memberships WHERE student_id = ?", studentId);
    for (const g of groupIds) this.sql.exec("INSERT INTO memberships (student_id, group_id) VALUES (?, ?)", studentId, g);
  }

  private createStudent(body: Body): Result<Student> {
    const displayName = text(body, "displayName", LIMITS.name, { required: true, label: "顯示名" })!;
    const homeClass = text(body, "homeClass", LIMITS.name, { label: "原班" }) ?? "";
    const homeroomTeacher = text(body, "homeroomTeacher", LIMITS.name, { label: "導師稱呼" }) ?? "";
    const groupIds = idList(body, "groupIds", LIMITS.groups) ?? [];
    this.checkGroups(groupIds);
    if (this.count("students") >= LIMITS.students) return fail(400, `最多 ${LIMITS.students} 位學生`);
    const id = newId();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        "INSERT INTO students (id, display_name, home_class, homeroom_teacher, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
        id,
        displayName,
        homeClass,
        homeroomTeacher,
        Date.now(),
      );
      this.setMemberships(id, groupIds);
    });
    return ok(this.students().find((s) => s.id === id)!);
  }

  private updateStudent(id: string, body: Body): Result {
    if (!this.exists("students", id)) return fail(404, "找不到這位學生");
    const displayName = text(body, "displayName", LIMITS.name, { label: "顯示名" });
    const homeClass = text(body, "homeClass", LIMITS.name, { label: "原班" });
    const homeroomTeacher = text(body, "homeroomTeacher", LIMITS.name, { label: "導師稱呼" });
    const groupIds = idList(body, "groupIds", LIMITS.groups);
    const active = bool(body, "active");
    if (displayName !== undefined && !displayName) return fail(400, "請填寫顯示名");
    if (groupIds) this.checkGroups(groupIds);
    this.ctx.storage.transactionSync(() => {
      if (displayName !== undefined) this.sql.exec("UPDATE students SET display_name = ? WHERE id = ?", displayName, id);
      if (homeClass !== undefined) this.sql.exec("UPDATE students SET home_class = ? WHERE id = ?", homeClass, id);
      if (homeroomTeacher !== undefined) this.sql.exec("UPDATE students SET homeroom_teacher = ? WHERE id = ?", homeroomTeacher, id);
      if (active !== undefined) this.sql.exec("UPDATE students SET active = ? WHERE id = ?", active ? 1 : 0, id);
      // 停用時把學生平板上的登入一起登出；之後重新啟用也要重新點圖卡
      if (active === false) this.kiosk.signOutStudent(id);
      if (groupIds) this.setMemberships(id, groupIds);
    });
    return ok({ id });
  }

  private createReason(body: Body): Result<Reason> {
    const label = text(body, "label", LIMITS.name, { required: true, label: "理由" })!;
    const points = int(body, "points", 1, LIMITS.maxPoints, { required: true, label: "分數" })!;
    if (this.count("reasons") >= LIMITS.reasons) return fail(400, `最多 ${LIMITS.reasons} 個理由`);
    const reason: Reason = { id: newId(), label, points, active: true };
    this.sql.exec("INSERT INTO reasons (id, label, points, active, created_at) VALUES (?, ?, ?, 1, ?)", reason.id, label, points, Date.now());
    return ok(reason);
  }

  private updateReason(id: string, body: Body): Result {
    if (!this.exists("reasons", id)) return fail(404, "找不到這個理由");
    const label = text(body, "label", LIMITS.name, { label: "理由" });
    const points = int(body, "points", 1, LIMITS.maxPoints, { label: "分數" });
    const active = bool(body, "active");
    if (label !== undefined && !label) return fail(400, "請填寫理由");
    if (label !== undefined) this.sql.exec("UPDATE reasons SET label = ? WHERE id = ?", label, id);
    if (points !== undefined) this.sql.exec("UPDATE reasons SET points = ? WHERE id = ?", points, id);
    if (active !== undefined) this.sql.exec("UPDATE reasons SET active = ? WHERE id = ?", active ? 1 : 0, id);
    return ok({ id });
  }

  private award(me: Me, body: Body): Result<{ events: PointEvent[] }> {
    const reasonId = text(body, "reasonId", 40, { required: true, label: "理由" })!;
    const reason = this.sql
      .exec<{ label: string; points: number }>("SELECT label, points FROM reasons WHERE id = ? AND active = 1", reasonId)
      .toArray()[0];
    if (!reason) return fail(400, "這個理由不存在或已停用");
    const studentIds = idList(body, "studentIds", LIMITS.students);
    const groupId = text(body, "groupId", 40, { label: "組別" });
    let targets: string[];
    if (groupId) {
      const group = this.sql.exec("SELECT 1 FROM class_groups WHERE id = ? AND active = 1", groupId).toArray();
      if (!group.length) return fail(400, "這個組不存在或已停用");
      targets = this.sql
        .exec<{ id: string }>(
          `SELECT s.id AS id FROM students s JOIN memberships m ON m.student_id = s.id
           WHERE m.group_id = ? AND s.active = 1 ORDER BY s.created_at`,
          groupId,
        )
        .toArray()
        .map((r) => r.id);
    } else if (studentIds && studentIds.length) {
      for (const sid of studentIds) {
        if (!this.sql.exec("SELECT 1 FROM students WHERE id = ? AND active = 1", sid).toArray().length) {
          return fail(400, "有學生不存在或已停用");
        }
      }
      targets = studentIds;
    } else {
      return fail(400, "請選擇學生或組別");
    }
    if (!targets.length) return fail(400, "這組目前沒有學生");
    const now = Date.now();
    const ids: string[] = [];
    this.ctx.storage.transactionSync(() => {
      for (const sid of targets) {
        const id = newId();
        ids.push(id);
        this.sql.exec(
          `INSERT INTO point_events (id, student_id, reason_id, reason_label, points, teacher_email, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id,
          sid,
          reasonId,
          reason.label,
          reason.points,
          me.email,
          now,
        );
      }
    });
    return ok({ events: ids.map((id) => this.event(id)!) });
  }

  private undo(me: Me, id: string): Result {
    const row = this.sql.exec<{ undone_at: number | null }>("SELECT undone_at FROM point_events WHERE id = ?", id).toArray()[0];
    if (!row) return fail(404, "找不到這筆加分");
    if (row.undone_at !== null) return fail(409, "這筆加分已經撤銷過了");
    this.sql.exec("UPDATE point_events SET undone_at = ?, undone_by = ? WHERE id = ?", Date.now(), me.email, id);
    return ok({ event: this.event(id) });
  }

  private createReward(body: Body): Result<Reward> {
    const threshold = int(body, "threshold", 1, LIMITS.maxThreshold, { required: true, label: "門檻分數" })!;
    const title = text(body, "title", LIMITS.rewardTitle, { required: true, label: "獎勵內容" })!;
    if (this.count("rewards") >= LIMITS.rewards) return fail(400, `最多 ${LIMITS.rewards} 項獎勵`);
    const reward: Reward = { id: newId(), threshold, title, active: true };
    this.sql.exec("INSERT INTO rewards (id, threshold, title, active, created_at) VALUES (?, ?, ?, 1, ?)", reward.id, threshold, title, Date.now());
    return ok(reward);
  }

  private updateReward(id: string, body: Body): Result {
    if (!this.exists("rewards", id)) return fail(404, "找不到這項獎勵");
    const threshold = int(body, "threshold", 1, LIMITS.maxThreshold, { label: "門檻分數" });
    const title = text(body, "title", LIMITS.rewardTitle, { label: "獎勵內容" });
    const active = bool(body, "active");
    if (title !== undefined && !title) return fail(400, "請填寫獎勵內容");
    if (threshold !== undefined) this.sql.exec("UPDATE rewards SET threshold = ? WHERE id = ?", threshold, id);
    if (title !== undefined) this.sql.exec("UPDATE rewards SET title = ? WHERE id = ?", title, id);
    if (active !== undefined) this.sql.exec("UPDATE rewards SET active = ? WHERE id = ?", active ? 1 : 0, id);
    return ok({ id });
  }

  private grant(me: Me, rewardId: string, body: Body, granted: boolean): Result {
    const studentId = text(body, "studentId", 40, { required: true, label: "學生" })!;
    const reward = this.sql.exec<{ threshold: number }>("SELECT threshold FROM rewards WHERE id = ? AND active = 1", rewardId).toArray()[0];
    if (!reward) return fail(404, "找不到這項獎勵");
    if (!this.exists("students", studentId)) return fail(404, "找不到這位學生");
    if (!granted) {
      this.sql.exec("DELETE FROM grants WHERE reward_id = ? AND student_id = ?", rewardId, studentId);
      return ok({ rewardId, studentId });
    }
    if (this.total(studentId) < reward.threshold) return fail(409, "還沒達到這項獎勵的門檻");
    this.sql.exec(
      `INSERT INTO grants (reward_id, student_id, granted_at, granted_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(reward_id, student_id) DO NOTHING`,
      rewardId,
      studentId,
      Date.now(),
      me.email,
    );
    return ok({ rewardId, studentId });
  }

  /* ---------- 讀取 ---------- */

  private total(studentId: string): number {
    return this.sql
      .exec<{ t: number | null }>("SELECT SUM(points) AS t FROM point_events WHERE student_id = ? AND undone_at IS NULL", studentId)
      .one().t ?? 0;
  }

  private event(id: string): PointEvent | null {
    return this.events(`WHERE e.id = ?`, [id])[0] ?? null;
  }

  private events(where: string, args: unknown[], limit = LIMITS.recentEvents): PointEvent[] {
    return this.sql
      .exec<{
        id: string;
        student_id: string;
        student_name: string | null;
        reason_label: string;
        points: number;
        teacher_email: string;
        created_at: number;
        undone_at: number | null;
        undone_by: string | null;
      }>(
        `SELECT e.id, e.student_id, s.display_name AS student_name, e.reason_label, e.points, e.teacher_email,
                e.created_at, e.undone_at, e.undone_by
         FROM point_events e LEFT JOIN students s ON s.id = e.student_id
         ${where} ORDER BY e.created_at DESC, e.rowid DESC LIMIT ${limit}`,
        ...args,
      )
      .toArray()
      .map((r) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name ?? "",
        reasonLabel: r.reason_label,
        points: r.points,
        teacherEmail: r.teacher_email,
        createdAt: r.created_at,
        undoneAt: r.undone_at,
        undoneBy: r.undone_by,
      }));
  }

  private students(): Student[] {
    const rewards = this.rewards().filter((r) => r.active);
    const totals = new Map(
      this.sql
        .exec<{ student_id: string; t: number }>(
          "SELECT student_id, SUM(points) AS t FROM point_events WHERE undone_at IS NULL GROUP BY student_id",
        )
        .toArray()
        .map((r) => [r.student_id, r.t]),
    );
    const groups = new Map<string, string[]>();
    for (const m of this.sql.exec<{ student_id: string; group_id: string }>("SELECT student_id, group_id FROM memberships").toArray()) {
      const list = groups.get(m.student_id) ?? [];
      list.push(m.group_id);
      groups.set(m.student_id, list);
    }
    const grants = new Map<string, number>();
    for (const g of this.sql.exec<{ reward_id: string; student_id: string; granted_at: number }>("SELECT * FROM grants").toArray()) {
      grants.set(`${g.reward_id}:${g.student_id}`, g.granted_at);
    }
    const withCards = this.kiosk.withCards();
    return this.sql
      .exec<{ id: string; display_name: string; home_class: string; homeroom_teacher: string; active: number }>(
        "SELECT id, display_name, home_class, homeroom_teacher, active FROM students ORDER BY created_at, rowid",
      )
      .toArray()
      .map((r) => {
        const total = totals.get(r.id) ?? 0;
        return {
          id: r.id,
          displayName: r.display_name,
          homeClass: r.home_class,
          homeroomTeacher: r.homeroom_teacher,
          groupIds: groups.get(r.id) ?? [],
          active: !!r.active,
          total,
          hasCards: withCards.has(r.id),
          rewards: rewards.map((w) => ({
            rewardId: w.id,
            unlocked: total >= w.threshold,
            grantedAt: grants.get(`${w.id}:${r.id}`) ?? null,
          })),
        };
      });
  }

  /* ---------- 學生平板與學生頁 ---------- */

  // 每個組的色紙位置：照全部組別（含停用）的建立順序，和老師端一致
  private groupColors(): Map<string, number> {
    const ids = this.sql.exec<{ id: string }>("SELECT id FROM class_groups ORDER BY created_at, rowid").toArray();
    return new Map(ids.map((g, i) => [g.id, i]));
  }

  // 選人畫面：只有使用中的組與學生的顯示名，不給分數或其他欄位
  private roster(device: DeviceAuth): KioskRoster {
    const colors = this.groupColors();
    const groups = this.sql
      .exec<{ id: string; name: string }>("SELECT id, name FROM class_groups WHERE active = 1 ORDER BY created_at, rowid")
      .toArray()
      .map((g) => ({ id: g.id, name: g.name, color: colors.get(g.id) ?? 0 }));
    const active = new Set(groups.map((g) => g.id));
    const memberships = new Map<string, string[]>();
    for (const m of this.sql.exec<{ student_id: string; group_id: string }>("SELECT student_id, group_id FROM memberships").toArray()) {
      if (active.has(m.group_id)) memberships.set(m.student_id, [...(memberships.get(m.student_id) ?? []), m.group_id]);
    }
    const withCards = this.kiosk.withCards();
    const students = this.sql
      .exec<{ id: string; display_name: string }>("SELECT id, display_name FROM students WHERE active = 1 ORDER BY created_at, rowid")
      .toArray()
      .map((s) => ({
        id: s.id,
        displayName: s.display_name,
        groupIds: (memberships.get(s.id) ?? []).sort((a, b) => (colors.get(a) ?? 0) - (colors.get(b) ?? 0)),
        ready: withCards.has(s.id),
      }));
    return { title: this.publicTitle(), mode: device.mode, groups, students };
  }

  // 學生自己：顯示名、累積分、獎勵進度、聯絡簿。不含其他學生的任何資料
  private studentView(device: DeviceAuth, studentId: string): StudentView {
    const s = this.sql.exec<{ display_name: string }>("SELECT display_name FROM students WHERE id = ?", studentId).one();
    const colors = this.groupColors();
    const first = this.sql
      .exec<{ group_id: string }>(
        `SELECT m.group_id FROM memberships m JOIN class_groups g ON g.id = m.group_id
         WHERE m.student_id = ? AND g.active = 1 ORDER BY g.created_at, g.rowid LIMIT 1`,
        studentId,
      )
      .toArray()[0];
    const total = this.total(studentId);
    const granted = new Set(
      this.sql.exec<{ reward_id: string }>("SELECT reward_id FROM grants WHERE student_id = ?", studentId).toArray().map((g) => g.reward_id),
    );
    return {
      mode: device.mode,
      title: this.publicTitle(),
      displayName: s.display_name,
      color: first ? (colors.get(first.group_id) ?? -1) : -1,
      total,
      rewards: this.rewards()
        .filter((w) => w.active)
        .map((w) => ({ id: w.id, title: w.title, threshold: w.threshold, unlocked: total >= w.threshold, granted: granted.has(w.id) })),
      diary: this.diary.forStudent(studentId).map((d) => ({ ...d, color: colors.get(d.groupId) ?? -1 })),
      checkin: this.checkins.forStudent(studentId),
    };
  }

  private rewards(): Reward[] {
    return this.sql
      .exec<{ id: string; threshold: number; title: string; active: number }>(
        "SELECT id, threshold, title, active FROM rewards ORDER BY threshold, created_at",
      )
      .toArray()
      .map((r) => ({ id: r.id, threshold: r.threshold, title: r.title, active: !!r.active }));
  }

  private state(me: Me): ClassState {
    const teachers: Teacher[] = this.sql
      .exec<{ email: string; name: string; active: number; added_at: number }>(
        "SELECT email, name, active, added_at FROM teachers ORDER BY added_at",
      )
      .toArray()
      .map((t) => ({ email: t.email, name: t.name, active: !!t.active, addedAt: t.added_at }));
    const groups: Group[] = this.sql
      .exec<{ id: string; name: string; active: number }>("SELECT id, name, active FROM class_groups ORDER BY created_at, rowid")
      .toArray()
      .map((g) => ({ id: g.id, name: g.name, active: !!g.active }));
    const reasons: Reason[] = this.sql
      .exec<{ id: string; label: string; points: number; active: number }>("SELECT id, label, points, active FROM reasons ORDER BY created_at, rowid")
      .toArray()
      .map((r) => ({ id: r.id, label: r.label, points: r.points, active: !!r.active }));
    return {
      me,
      title: this.publicTitle(),
      teachers,
      groups,
      reasons,
      rewards: this.rewards(),
      students: this.students(),
      events: this.events("", []),
      boards: this.board.boards(),
      share: this.board.share(),
      agentKeys: this.board.agentKeys(),
      devices: this.kiosk.devices(),
      checkin: this.checkins.view(),
      periods: this.schedule.periods(),
      slots: this.schedule.slots(),
    };
  }
}
