// 色紙：每個組依建立順序固定擁有一種顏色（標籤、卡片滾邊、之後的課表都用它）；
// 加分理由的圖釘也從同一組顏色取。ink 是放在該色上的文字顏色。
export const PAPERS = [
  { name: "番茄紅", hue: "var(--paper-red)", ink: "var(--on-red)" },
  { name: "天空藍", hue: "var(--paper-sky)", ink: "var(--on-sky)" },
  { name: "向日葵黃", hue: "var(--paper-sun)", ink: "var(--on-sun)" },
  { name: "草綠", hue: "var(--paper-grass)", ink: "var(--on-grass)" },
  { name: "葡萄紫", hue: "var(--paper-grape)", ink: "var(--on-grape)" },
  { name: "橘子", hue: "var(--paper-orange)", ink: "var(--on-orange)" },
  { name: "桃粉", hue: "var(--paper-peach)", ink: "var(--on-peach)" },
  { name: "湖水青", hue: "var(--paper-teal)", ink: "var(--on-teal)" },
] as const;

export function paperAt(index: number) {
  return PAPERS[((index % PAPERS.length) + PAPERS.length) % PAPERS.length];
}
