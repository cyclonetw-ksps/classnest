// 讓 aria-invalid 跟著 :user-invalid 走（Modern Web Guidance：accessible-error-announcement）。
// 欄位用 data-error 指向錯誤訊息的 id；錯誤只在使用者離開欄位或送出後才出現，
// 而且只有出現時才列進 aria-describedby，避免一進欄位就被念「格式錯誤」。

let installed = false;

function linkError(el: HTMLElement, shown: boolean) {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
}

function sync(target: EventTarget | null) {
  if (!(target instanceof HTMLElement) || !target.matches("input, select, textarea")) return;
  let invalid = false;
  try {
    invalid = target.matches(":user-invalid");
  } catch {
    invalid = false;
  }
  target.setAttribute("aria-invalid", invalid ? "true" : "false");
  linkError(target, invalid);
}

export function installFieldValidation() {
  if (installed) return;
  installed = true;
  document.addEventListener("blur", (e) => sync(e.target), true);
  document.addEventListener("input", (e) => {
    if ((e.target as HTMLElement | null)?.hasAttribute?.("aria-invalid")) sync(e.target);
  });
  document.addEventListener("change", (e) => sync(e.target), true);
  document.addEventListener("invalid", (e) => sync(e.target), true);
}
