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

export interface ClassState {
  me: { email: string; name: string };
  title: string;
  teachers: Teacher[];
  groups: Group[];
  reasons: Reason[];
  rewards: Reward[];
  students: Student[];
  events: PointEvent[];
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
} as const;
