import { useState } from "preact/hooks";
import { LIMITS, type ClassState } from "../shared/types";
import { request } from "./api";
import { AgentKeys } from "./AgentKeys";
import { Devices } from "./Devices";
import type { Act } from "./App";

export function SettingsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [title, setTitle] = useState(state.title);
  const [email, setEmail] = useState("");

  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title">設定</h2>
      <form
        class="form card"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => request("PUT", "settings", { title }), "已更新網站標題");
        }}
      >
        <div class="field">
          <label for="t-title">網站標題</label>
          <input id="t-title" required maxLength={LIMITS.title} pattern=".*\S.*" value={title} onInput={(e) => setTitle(e.currentTarget.value)} data-error="t-title-err" />
          <span class="error-msg" id="t-title-err">
            請填寫網站標題（最多 {LIMITS.title} 字）。
          </span>
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">
            儲存標題
          </button>
        </div>
      </form>

      <h3>老師</h3>
      <p class="hint">被邀請的老師用自己的 Google 帳號登入後，會看到同一份名單，權限相同。</p>
      <form
        class="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => request("POST", "teachers", { email }), `已邀請 ${email.trim()}`)) setEmail("");
        }}
      >
        <label for="t-email" class="visually-hidden">
          老師的 Google 信箱
        </label>
        <input id="t-email" type="email" required autoComplete="off" placeholder="老師的 Google 信箱" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        <button class="btn primary" type="submit">
          邀請老師
        </button>
      </form>
      <ul class="rows">
        {state.teachers.map((t) => (
          <li key={t.email} class={t.active ? "" : "inactive"}>
            <div class="row-main">
              <strong>{t.name}</strong>
              <span class="meta">
                {t.email}
                {t.email === state.me.email && "（你）"}
                {!t.active && "｜已停用"}
              </span>
            </div>
            {t.email !== state.me.email && (
              <button
                class="btn small"
                onClick={() =>
                  act(() => request("PATCH", `teachers/${encodeURIComponent(t.email)}`, { active: !t.active }), t.active ? `已停用 ${t.email}` : `已啟用 ${t.email}`)
                }
              >
                {t.active ? "停用" : "啟用"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <Devices state={state} act={act} />

      <AgentKeys state={state} act={act} />
    </section>
  );
}
