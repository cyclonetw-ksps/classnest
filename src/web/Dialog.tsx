import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";
import { Close } from "./icons";

// 原生 <dialog>（Modern Web Guidance：dialog、light-dismiss-a-dialog）。
// 開關由 open 控制；按 Esc、點外面或關閉按鈕都會呼叫 onClose。
export function Dialog(props: { open: boolean; title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => props.onClose();
    d.addEventListener("close", onClose);
    // Safari 還不支援 closedby：自己補「點外面關閉」，按下與放開都在外面才算
    let cleanup = () => {};
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const outside = (e: PointerEvent) => {
        const r = d.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      const down = (e: PointerEvent) => (pressedOutside = outside(e));
      const up = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) d.close();
      };
      d.addEventListener("pointerdown", down);
      d.addEventListener("pointerup", up);
      cleanup = () => {
        d.removeEventListener("pointerdown", down);
        d.removeEventListener("pointerup", up);
      };
    }
    return () => {
      d.removeEventListener("close", onClose);
      cleanup();
    };
  }, [props.onClose]);

  return (
    <dialog ref={ref} class={props.wide ? "wide" : undefined} {...({ closedby: "any" } as object)} aria-labelledby={titleId}>
      <div class="dialog-head">
        <h1 id={titleId}>{props.title}</h1>
        <button type="button" class="icon-btn" aria-label="關閉" onClick={() => ref.current?.close()}>
          <Close />
        </button>
      </div>
      {props.open && props.children}
    </dialog>
  );
}
