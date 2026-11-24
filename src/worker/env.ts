import type { ClassroomDO } from "./classroom";

export interface Env {
  ASSETS: Fetcher;
  CLASSROOM: DurableObjectNamespace<ClassroomDO>;
  // Google 登入的用戶端 ID（公開值，部署端注入）
  GOOGLE_CLIENT_ID?: string;
  // 第一位老師的 Google 信箱（部署端注入）；他登入時自動成為老師
  FIRST_TEACHER_EMAIL?: string;
}
