import { describe, expect, it } from "vitest";
import { diaryText, suggestDiary, type DiaryLesson } from "../src/shared/diary";

const l = (extra: Partial<DiaryLesson>): DiaryLesson => ({ groupId: "g1", subject: "國語", homework: "", bring: "", cancelled: false, ...extra });

describe("從當天課表帶入聯絡簿", () => {
  it("只有一節有作業時，不加科目", () => {
    expect(suggestDiary([l({ homework: "習作 p.32", bring: "國語課本" })], "g1")).toEqual({ homework: "習作 p.32", bring: "國語課本" });
  });

  it("多節有作業時，每節一行並寫科目；要帶的東西合併去重", () => {
    const s = suggestDiary(
      [
        l({ homework: "習作 p.32", bring: "國語課本、鉛筆盒" }),
        l({ subject: "數學", homework: "課本 p.18", bring: "鉛筆盒，量角器" }),
        l({ subject: "生活", bring: "" }),
      ],
      "g1",
    );
    expect(s).toEqual({ homework: "國語：習作 p.32\n數學：課本 p.18", bring: "國語課本、鉛筆盒、量角器" });
  });

  it("別組的節與停課的節不帶入", () => {
    const s = suggestDiary(
      [
        l({ groupId: "g2", homework: "別組作業", bring: "別組課本" }),
        l({ cancelled: true, homework: "停課作業", bring: "停課要帶" }),
        l({ subject: "數學", homework: "課本 p.18" }),
      ],
      "g1",
    );
    expect(s).toEqual({ homework: "課本 p.18", bring: "" });
  });

  it("沒有課就是空的", () => {
    expect(suggestDiary([], "g1")).toEqual({ homework: "", bring: "" });
  });
});

describe("複製到 LINE 的文字", () => {
  const entry = { date: "2026-11-25", homework: "習作 p.32", bring: "國語課本", note: "明天戶外教學，請穿運動服" };

  it("【月/日 組名】開頭，接作業、要帶、備註，每項一行", () => {
    expect(diaryText(entry, "國語 A 組")).toBe("【11/25 國語 A 組】\n作業：習作 p.32\n要帶：國語課本\n備註：明天戶外教學，請穿運動服");
  });

  it("空的項目不寫", () => {
    expect(diaryText({ ...entry, bring: "", note: "" }, "國語 A 組")).toBe("【11/25 國語 A 組】\n作業：習作 p.32");
  });

  it("給個別學生時多一行他的加註；沒有加註就和整組一樣", () => {
    expect(diaryText(entry, "國語 A 組", { name: "小明", text: "今天很專心" })).toBe(
      "【11/25 國語 A 組】\n作業：習作 p.32\n要帶：國語課本\n備註：明天戶外教學，請穿運動服\n小明：今天很專心",
    );
    expect(diaryText(entry, "國語 A 組", { name: "小明", text: "" })).toBe(diaryText(entry, "國語 A 組"));
  });
});
