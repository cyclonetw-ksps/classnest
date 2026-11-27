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
  // 老師是否已經產生圖卡密碼（密碼本身只在「印圖卡密碼」時才給）
  hasCards: boolean;
}

// 學生平板：老師在那台平板上設定，只有學生平板能列出名單、讓學生用圖卡登入。
// shared（共用）每位學生登入 10 分鐘就失效；personal（個人）一直記住，直到老師登出那台平板
export type DeviceMode = "shared" | "personal";
export interface Device {
  id: string;
  name: string;
  mode: DeviceMode;
  createdAt: number;
  lastSeenAt: number | null;
  // 個人平板目前記住的學生
  studentName: string | null;
}

// 印圖卡密碼用：card 是 CARD_NAMES 的位置
export interface LoginCards {
  studentId: string;
  displayName: string;
  groupIds: string[];
  cards: number[];
}

// 學生平板上的選人畫面：只有組別與顯示名，沒有分數或其他欄位。color 是組別在全部組別裡的位置（決定色紙）
export interface KioskRoster {
  title: string;
  mode: DeviceMode;
  groups: { id: string; name: string; color: number }[];
  students: { id: string; displayName: string; groupIds: string[]; ready: boolean }[];
}

// 學生登入後看到的自己：分數、獎勵進度、所屬組最近一次已發送的聯絡簿與給自己的加註
export interface StudentView {
  mode: DeviceMode;
  title: string;
  displayName: string;
  color: number;
  total: number;
  rewards: { id: string; title: string; threshold: number; unlocked: boolean; granted: boolean }[];
  diary: { date: string; groupId: string; groupName: string; homework: string; bring: string; note: string; myNote: string }[];
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
  devices: Device[];
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
  // 學生平板與圖卡密碼
  devices: 30,
  cardAttempts: 5,
  cardLockMs: 5 * 60 * 1000,
  sharedSessionMs: 10 * 60 * 1000,
  // 通關碼連續答錯幾次後暫停一段時間
  pinAttempts: 10,
  pinLockMs: 10 * 60 * 1000,
} as const;
