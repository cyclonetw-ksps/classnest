// 少量自繪圖示，一致的 2px 線寬。只在需要的地方用，不拿文字符號代替。
const base = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" } as const;

export const Check = () => (
  <svg {...base}>
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);

export const Undo = () => (
  <svg {...base}>
    <path d="M7 5L3 9l4 4" />
    <path d="M3 9h9a5 5 0 010 10h-2" />
  </svg>
);

export const Plus = () => (
  <svg {...base}>
    <path d="M10 4v12M4 10h12" />
  </svg>
);

export const Close = () => (
  <svg {...base}>
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
);
