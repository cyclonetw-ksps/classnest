// 前後端共用的資料形狀。伺服器回應一律是這些型別。

export interface PublicConfig {
  title: string;
  googleClientId: string;
}

export interface Teacher {
  email: string;
  name: string;
  active: boolean;
  addedAt: number;
}

export interface Group {
  id: string;
  name: string;
  active: boolean;
}

export interface Reason {
  id: string;
  label: string;
  points: number;
  active: boolean;
}

export interface Reward {
  id: string;
  threshold: number;
  title: string;
  active: boolean;
}

export interface StudentReward {
  rewardId: string;
  unlocked: boolean;
  grantedAt: number | null;
}

export interface Student {
  id: string;
  displayName: string;
  homeClass: string;
  homeroomTeacher: string;
  groupIds: string[];
  active: boolean;
  total: number;
  rewards: StudentReward[];
}

export interface PointEvent {
  id: string;
  studentId: string;
  studentName: string;
  reasonLabel: string;
  points: number;
  teacherEmail: string;
  createdAt: number;
  undoneAt: number | null;
  undoneBy: string | null;
}

export type CardKind = "text" | "link" | "homework";

// 公布欄的一張便條。createdBy 是老師信箱，或「agent：金鑰名稱」
export interface BoardCard {
  id: string;
  kind: CardKind;
  title: string;
  body: string;
  url: string;
  dueDate: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// 公布欄的一個面板（一欄便條）。groupIds 空白代表全班
export interface Board {
  id: string;
  title: string;
  groupIds: string[];
  shared: boolean;
  cards: BoardCard[];
}

export interface ShareInfo {
  code: string;
  hasPin: boolean;
}

export interface AgentKey {
  id: string;
  name: string;
  active: boolean;
  createdBy: string;
  createdAt: number;
  lastUsedAt: number | null;
}

// 課表：一節的時間
export interface Period {
  id: string;
  label: string;
  start: string; // HH:MM
  end: string;
}

// 固定週課表的一格（週一到週五 × 節次）
export interface Slot {
  weekday: number;
  periodId: string;
  groupId: string | null;
  subject: string;
  bring: string;
}

// 某一週某一天某一節：已經把固定課表、換課、停課合在一起
export interface Lesson {
  weekday: number;
  date: string;
  periodId: string;
  groupId: string | null;
  subject: string;
  // 固定課表原本的樣子；沒有排課是 null
  base: { groupId: string | null; subject: string; bring: string } | null;
  changed: boolean;
  cancelled: boolean;
  note: string;
  content: string;
  homework: string;
  // 這週要帶的東西（ownBring）有填就用它，沒填用固定課表的預設
  bring: string;
  ownBring: string;
  updatedBy: string;
  updatedAt: number | null;
}

export interface WeekView {
  weekStart: string;
  days: { weekday: number; date: string }[];
  periods: Period[];
  lessons: Lesson[];
}

// 聯絡簿：一天一組一則。empty 是還沒寫（只有從課表帶入的建議），draft 是草稿（老師或 agent 寫的），
// sent 是老師按了發送（分享頁看得到）
export type DiaryStatus = "empty" | "draft" | "sent";

export interface DiaryEntry {
  date: string;
  groupId: string;
  status: DiaryStatus;
  homework: string;
  bring: string;
  note: string;
  // 從當天課表帶入的建議（這一組各節的作業與要帶的東西；停課的節不算）
  suggested: { homework: string; bring: string };
  // 給個別學生的加註；不會出現在分享頁，也不給 agent
  studentNotes: { studentId: string; text: string }[];
  updatedBy: string;
  updatedAt: number | null;
  sentAt: number | null;
}

export interface DiaryDay {
  date: string;
  entries: DiaryEntry[];
}

export interface ClassState {
  me: { email: string; name: string };
  title: string;
  teachers: Teacher[];
  groups: Group[];
  reasons: Reason[];
  rewards: Reward[];
  students: Student[];
  events: PointEvent[];
  boards: Board[];
  share: ShareInfo;
  agentKeys: AgentKey[];
  periods: Period[];
  slots: Slot[];
}

// 分享頁看到的內容：只有分享的面板與組別名稱，沒有任何學生資料，也不顯示是誰貼的
export type PublicCard = Omit<BoardCard, "createdBy">;
export interface PublicBoard {
  id: string;
  title: string;
  groupIds: string[];
  cards: PublicCard[];
}
// 分享頁的聯絡簿：只有已發送的，沒有個別加註、也沒有是誰寫的
export interface PublicDiary {
  date: string;
  groupId: string;
  homework: string;
  bring: string;
  note: string;
}
export interface PublicView {
  title: string;
  // color 是這個組在全部組別裡的順序，用來取同一張色紙（和老師端一致）
  groups: { id: string; name: string; color: number }[];
  boards: PublicBoard[];
  diary: PublicDiary[];
}

export const LIMITS = {
  title: 40,
  name: 20,
  rewardTitle: 40,
  maxPoints: 100,
  maxThreshold: 100000,
  students: 200,
  groups: 50,
  reasons: 50,
  rewards: 50,
  teachers: 10,
  recentEvents: 50,
  boards: 30,
  boardTitle: 30,
  cardsPerBoard: 100,
  cardTitle: 60,
  cardBody: 1000,
  url: 2000,
  agentKeys: 20,
  keyName: 30,
  periods: 12,
  periodLabel: 10,
  subject: 20,
  bring: 60,
  lessonContent: 500,
  homework: 300,
  lessonNote: 40,
  diaryHomework: 500,
  diaryBring: 200,
  diaryNote: 300,
  studentNote: 200,
  // 分享頁顯示最近幾個有發送聯絡簿的日期
  publicDiaryDays: 5,
  // 通關碼連續答錯幾次後暫停一段時間
  pinAttempts: 10,
  pinLockMs: 10 * 60 * 1000,
} as const;
