// 圖卡密碼：9 張固定位置的圖卡，學生依序點 3 張不重複的（9×8×7 = 504 種）。
// 圖卡用位置（0～8）表示；名字給老師印密碼與螢幕報讀用。
export const CARD_NAMES = ["太陽", "月亮", "星星", "愛心", "花", "樹", "魚", "蘋果", "房子"] as const;
export const CARD_COUNT = CARD_NAMES.length;
export const PASSWORD_LENGTH = 3;

export function isCardSequence(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === PASSWORD_LENGTH &&
    value.every((c) => Number.isInteger(c) && c >= 0 && c < CARD_COUNT) &&
    new Set(value).size === PASSWORD_LENGTH
  );
}
