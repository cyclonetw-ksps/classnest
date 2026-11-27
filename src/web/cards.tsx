// 圖卡密碼的 9 張圖：幾何形狀拼成的圖示，形狀與顏色都不一樣，低年級一眼認得。
// 深淺色模式都畫在白紙上、用同一組顏色，印出來也一樣。順序要和 CARD_NAMES 一致。
import { CARD_NAMES } from "../shared/cards";

const INK = "#1d2a30";
const line = { stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" } as const;

const SHAPES = [
  // 太陽
  <>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return <line key={i} x1={32 + Math.cos(a) * 19} y1={32 + Math.sin(a) * 19} x2={32 + Math.cos(a) * 27} y2={32 + Math.sin(a) * 27} stroke="#e0761e" stroke-width="5" stroke-linecap="round" />;
    })}
    <circle cx="32" cy="32" r="13" fill="#f0b323" {...line} />
  </>,
  // 月亮
  <path d="M38 8a24 24 0 1 0 20 34a19 19 0 1 1-20-34z" fill="#9fb8dc" {...line} />,
  // 星星
  <path d="M32 6l7.6 16.2 17.4 2.2-12.8 12.1 3.3 17.4L32 45.4l-15.5 8.5 3.3-17.4L7 24.4l17.4-2.2z" fill="#f0b323" {...line} />,
  // 愛心
  <path d="M32 54S8 40 8 23a12 12 0 0 1 24-3a12 12 0 0 1 24 3c0 17-24 31-24 31z" fill="#ab3c6f" {...line} />,
  // 花
  <>
    <path d="M32 40v18" stroke="#2e7634" stroke-width="4" stroke-linecap="round" />
    {Array.from({ length: 5 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      return <circle key={i} cx={32 + Math.cos(a) * 11} cy={26 + Math.sin(a) * 11} r="8.5" fill="#7a56b0" {...line} />;
    })}
    <circle cx="32" cy="26" r="6.5" fill="#f0b323" {...line} />
  </>,
  // 樹
  <>
    <rect x="28" y="44" width="8" height="14" rx="1.5" fill="#8a5a2b" {...line} />
    <path d="M32 6L12 30h9L10 46h44L43 30h9z" fill="#2e7634" {...line} />
  </>,
  // 魚
  <>
    <path d="M44 32L60 20v24z" fill="#2a6fae" {...line} />
    <ellipse cx="28" cy="32" rx="22" ry="14" fill="#2a6fae" {...line} />
    <circle cx="17" cy="29" r="3" fill="#fff" stroke={INK} stroke-width="2" />
  </>,
  // 蘋果
  <>
    <path d="M32 18c-4-4-20-6-22 10c-2 14 9 28 16 28c3 0 4-2 6-2s3 2 6 2c7 0 18-14 16-28c-2-16-18-14-22-10z" fill="#c23a24" {...line} />
    <path d="M32 18c0-5 1-9 4-12" fill="none" {...line} />
    <path d="M35 11c5-5 12-4 14-2c-3 4-9 5-14 2z" fill="#2e7634" {...line} />
  </>,
  // 房子
  <>
    <rect x="14" y="28" width="36" height="28" fill="#fffdf7" {...line} />
    <path d="M8 30L32 9l24 21z" fill="#c23a24" {...line} />
    <rect x="27" y="40" width="10" height="16" fill="#167570" {...line} />
  </>,
];

export function CardPicture({ index }: { index: number }) {
  return (
    <svg class="card-pic" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {SHAPES[index]}
    </svg>
  );
}

export const cardName = (index: number) => CARD_NAMES[index] ?? "";
