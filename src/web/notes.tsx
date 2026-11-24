import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { CardKind, PublicCard } from "../shared/types";
import { CopyButton } from "./copy";
import { Dialog } from "./Dialog";
import { QrIcon } from "./icons";
import { paperAt } from "./palette";
import { QrCode } from "./qr";

export const KIND_LABEL: Record<CardKind, string> = { text: "文字", link: "連結", homework: "作業" };
const WEEKDAY = "日一二三四五六";

export function dueLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}（${WEEKDAY[w]}）`;
}

// 網址只顯示網域與路徑開頭，完整網址在 QR Code 對話框裡
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const rest = (u.pathname + u.search).replace(/\/$/, "");
    return u.hostname.replace(/^www\./, "") + (rest.length > 24 ? `${rest.slice(0, 24)}…` : rest);
  } catch {
    return url;
  }
}

// 面板頂端的色紙：標了組別就用第一個組的色紙，全班用向日葵黃
export function boardPaper(groupIds: string[], colorOf: (id: string) => number) {
  const first = groupIds.map(colorOf).find((i) => i >= 0);
  return first === undefined ? { hue: "var(--paper-sun)", ink: "var(--on-sun)" } : paperAt(first);
}

// 一張便條。老師端與分享頁共用；actions 放老師的編輯與排序按鈕
export function Note({ card, footer, actions, level = 4 }: { card: PublicCard; footer?: ComponentChildren; actions?: ComponentChildren; level?: 3 | 4 }) {
  const Heading = level === 3 ? "h3" : "h4";
  const [qr, setQr] = useState(false);
  const label = card.title || card.body.slice(0, 20);
  return (
    <article class={`note kind-${card.kind}`} aria-label={`${KIND_LABEL[card.kind]}：${label}`}>
      <div class="note-kind">
        <span>{KIND_LABEL[card.kind]}</span>
        {actions && <div class="note-actions">{actions}</div>}
      </div>
      {card.title && <Heading class="note-title">{card.title}</Heading>}
      {card.kind === "homework" && card.dueDate && <p class="due">繳交 {dueLabel(card.dueDate)}</p>}
      {card.body && <p class="note-body">{card.body}</p>}
      {card.url && (
        <div class="note-link">
          <a href={card.url} target="_blank" rel="noopener noreferrer">
            {shortUrl(card.url)}
          </a>
          <button type="button" class="icon-btn" aria-label={`放大「${label}」的 QR Code`} onClick={() => setQr(true)}>
            <QrIcon />
          </button>
        </div>
      )}
      {footer && <p class="note-foot meta">{footer}</p>}
      {card.url && (
        <Dialog open={qr} title={label} onClose={() => setQr(false)} wide>
          <div class="qr-view">
            <QrCode text={card.url} label={`${label} 的 QR Code`} />
            <p class="qr-url">{card.url}</p>
            <div class="form-actions">
              <CopyButton text={card.url} label="複製網址">
                複製網址
              </CopyButton>
              <a class="btn primary" href={card.url} target="_blank" rel="noopener noreferrer">
                打開連結
              </a>
            </div>
          </div>
        </Dialog>
      )}
    </article>
  );
}
