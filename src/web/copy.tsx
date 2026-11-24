import { useEffect, useRef, useState } from "preact/hooks";
import { Check, Copy } from "./icons";

// 複製按鈕（Modern Web Guidance：copy-button）：結果寫進旁邊的 role="status"，成功換成勾，失敗也顯示
export function CopyButton({ text, label, children }: { text: string; label: string; children?: string }) {
  const [state, setState] = useState<"" | "ok" | "fail">("");
  const timer = useRef<number>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
    } catch {
      setState("fail");
    }
    timer.current = window.setTimeout(() => setState(""), 2000);
  }
  return (
    <span class="copy">
      <button type="button" class="btn small" onClick={copy} aria-label={children ? undefined : label} data-copied={state === "ok" ? "" : undefined}>
        {state === "ok" ? <Check /> : <Copy />}
        {children}
      </button>
      <span class="copy-tip" role="status">
        {state === "ok" ? "已複製" : state === "fail" ? "複製失敗，請長按選取" : ""}
      </span>
    </span>
  );
}
