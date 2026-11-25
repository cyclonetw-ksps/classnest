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

export const ArrowUp = () => (
  <svg {...base}>
    <path d="M10 16V4M5 9l5-5 5 5" />
  </svg>
);

export const ArrowDown = () => (
  <svg {...base}>
    <path d="M10 4v12M5 11l5 5 5-5" />
  </svg>
);

export const Pencil = () => (
  <svg {...base}>
    <path d="M13.5 3.5l3 3L7 16H4v-3z" />
  </svg>
);

export const Copy = () => (
  <svg {...base}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M13 4H5a2 2 0 00-2 2v7" />
  </svg>
);

export const QrIcon = () => (
  <svg {...base}>
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="12" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="12" width="5" height="5" rx="1" />
    <path d="M12 12h2v2M17 12v5h-5M14 17v-1" />
  </svg>
);

export const LinkIcon = () => (
  <svg {...base}>
    <path d="M8.5 11.5a3.5 3.5 0 005 0l2.5-2.5a3.5 3.5 0 00-5-5L10 5" />
    <path d="M11.5 8.5a3.5 3.5 0 00-5 0L4 11a3.5 3.5 0 005 5l1-1" />
  </svg>
);

export const Lock = () => (
  <svg {...base}>
    <rect x="4" y="9" width="12" height="8" rx="2" />
    <path d="M7 9V6.5a3 3 0 016 0V9" />
  </svg>
);

export const Share = () => (
  <svg {...base}>
    <circle cx="5" cy="10" r="2" />
    <circle cx="15" cy="5" r="2" />
    <circle cx="15" cy="15" r="2" />
    <path d="M7 9l6-3M7 11l6 3" />
  </svg>
);

export const Play = () => (
  <svg {...base}>
    <path d="M6 4l10 6-10 6z" />
  </svg>
);

export const Pause = () => (
  <svg {...base}>
    <path d="M7 4v12M13 4v12" />
  </svg>
);

export const Restart = () => (
  <svg {...base}>
    <path d="M4 10a6 6 0 106-6H7" />
    <path d="M9 1.5L6.5 4 9 6.5" />
  </svg>
);

export const Stop = () => (
  <svg {...base}>
    <rect x="5" y="5" width="10" height="10" rx="1.5" />
  </svg>
);

export const Bell = () => (
  <svg {...base}>
    <path d="M5 14V9a5 5 0 0110 0v5l1.5 1.5h-13z" />
    <path d="M8.5 17.5a1.5 1.5 0 003 0" />
  </svg>
);

export const BellOff = () => (
  <svg {...base}>
    <path d="M7 5.2A5 5 0 0115 9v4M5 9v5l-1.5 1.5H15" />
    <path d="M8.5 17.5a1.5 1.5 0 003 0M3 3l14 14" />
  </svg>
);

export const Expand = () => (
  <svg {...base}>
    <path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" />
  </svg>
);

export const Shrink = () => (
  <svg {...base}>
    <path d="M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5" />
  </svg>
);
