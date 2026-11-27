// 聯絡簿的純函式（前後端共用）：從當天課表帶入建議、組出複製到 LINE 的文字。
import { LIMITS, type Lesson } from "./types";

export type DiaryLesson = Pick<Lesson, "groupId" | "subject" | "homework" | "bring" | "cancelled">;

// lessons 是那一天依節次排好的課（已套用換課）。只算這一組、沒停課的節：
// 作業一節一行，超過一節有作業時前面寫科目；要帶的東西用「、」合併並去掉重複
export function suggestDiary(lessons: DiaryLesson[], groupId: string): { homework: string; bring: string } {
  const mine = lessons.filter((l) => l.groupId === groupId && !l.cancelled);
  const withHomework = mine.filter((l) => l.homework.trim());
  const homework =
    withHomework.length > 1
      ? withHomework.map((l) => (l.subject ? `${l.subject}：${l.homework.trim()}` : l.homework.trim())).join("\n")
      : (withHomework[0]?.homework.trim() ?? "");
  const items = [...new Set(mine.flatMap((l) => l.bring.split(/[、，,]/).map((x) => x.trim())).filter(Boolean))];
  return { homework: homework.slice(0, LIMITS.diaryHomework), bring: items.join("、").slice(0, LIMITS.diaryBring) };
}

const monthDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

// 「【11/25 國語 A 組】」開頭，接作業、要帶、備註（空的不寫）；給個別學生時最後多一行他的加註
export function diaryText(
  entry: { date: string; homework: string; bring: string; note: string },
  groupName: string,
  student?: { name: string; text: string },
): string {
  const lines = [`【${monthDay(entry.date)} ${groupName}】`];
  if (entry.homework.trim()) lines.push(`作業：${entry.homework.trim()}`);
  if (entry.bring.trim()) lines.push(`要帶：${entry.bring.trim()}`);
  if (entry.note.trim()) lines.push(`備註：${entry.note.trim()}`);
  if (student?.text.trim()) lines.push(`${student.name}：${student.text.trim()}`);
  return lines.join("\n");
}
