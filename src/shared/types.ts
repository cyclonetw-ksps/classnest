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
}

// 分享頁看到的內容：只有分享的面板與組別名稱，沒有任何學生資料，也不顯示是誰貼的
export type PublicCard = Omit<BoardCard, "createdBy">;
export interface PublicBoard {
  id: string;
  title: string;
  groupIds: string[];
  cards: PublicCard[];
}
export interface PublicView {
  title: string;
  groups: { id: string; name: string }[];
  boards: PublicBoard[];
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
  // 通關碼連續答錯幾次後暫停一段時間
  pinAttempts: 10,
  pinLockMs: 10 * 60 * 1000,
} as const;
