import { useState } from "preact/hooks";
import { LIMITS, type ClassState, type Device, type DeviceMode } from "../shared/types";
import { ApiError, request } from "./api";
import type { Act } from "./App";
import { Dialog } from "./Dialog";

const MODE_LABEL: Record<DeviceMode, string> = { shared: "共用", personal: "個人" };

function when(ms: number | null): string {
  if (!ms) return "還沒用過";
  const d = new Date(ms);
  return `最後使用 ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 設定頁的「學生平板」：把這台設成學生平板、列出所有學生平板、改名、登出
export function Devices({ state, act }: { state: ClassState; act: Act }) {
  const [enroll, setEnroll] = useState<{ name: string; mode: DeviceMode; error: string } | null>(null);
  const [edit, setEdit] = useState<{ device: Device; name: string; confirm: boolean } | null>(null);

  async function submitEnroll(e: Event) {
    e.preventDefault();
    if (!enroll) return;
    try {
      await request("POST", "devices", { name: enroll.name, mode: enroll.mode });
      // 伺服器已登出這台的老師；直接打開學生登入頁
      location.assign("/student");
    } catch (err) {
      setEnroll({ ...enroll, error: err instanceof ApiError ? err.message : "連線出了問題，請稍後再試" });
    }
  }

  async function rename(e: Event) {
    e.preventDefault();
    if (!edit) return;
    if (await act(() => request("PATCH", `devices/${edit.device.id}`, { name: edit.name }), `已改名為 ${edit.name.trim()}`)) setEdit(null);
  }

  return (
    <>
      <div class="section-head">
        <h3>學生平板</h3>
        <button class="btn" onClick={() => setEnroll({ name: "", mode: "shared", error: "" })}>
          把這台設成學生平板
        </button>
      </div>
      <p class="hint">
        學生只能在學生平板上點自己的名字、用圖卡登入。要設定哪一台，就用那一台登入老師帳號，再按上面的按鈕。學生登入頁是本站的 <code>/student</code>。
      </p>
      {state.devices.length === 0 ? (
        <p class="hint">還沒有學生平板。</p>
      ) : (
        <ul class="rows">
          {state.devices.map((d) => (
            <li key={d.id}>
              <div class="row-main">
                <strong>{d.name}</strong>
                <span class="meta">
                  {MODE_LABEL[d.mode]}平板
                  {d.mode === "personal" && `・${d.studentName ? `記住 ${d.studentName}` : "還沒有學生登入"}`}・{when(d.lastSeenAt)}
                </span>
              </div>
              <button class="btn small" onClick={() => setEdit({ device: d, name: d.name, confirm: false })} aria-label={`管理 ${d.name}`}>
                管理
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={enroll !== null} title="把這台設成學生平板" onClose={() => setEnroll(null)}>
        {enroll && (
          <form class="form" onSubmit={submitEnroll}>
            <div class="field">
              <label for="dv-name">這台的名字</label>
              <input
                id="dv-name"
                required
                maxLength={LIMITS.name}
                pattern=".*\S.*"
                placeholder="例如：國語角 iPad"
                autoFocus
                value={enroll.name}
                onInput={(e) => setEnroll({ ...enroll, name: e.currentTarget.value, error: "" })}
                data-error="dv-name-err"
              />
              <span class="error-msg" id="dv-name-err">
                請替這台取個名字（最多 {LIMITS.name} 字）。
              </span>
            </div>
            <fieldset class="field">
              <legend>誰用這台</legend>
              <div class="choices">
                <label class="choice">
                  <input type="radio" name="dv-mode" checked={enroll.mode === "shared"} onChange={() => setEnroll({ ...enroll, mode: "shared" })} />
                  <span>
                    <b>共用平板</b>
                    <span class="meta">學生輪流用；每次登入 10 分鐘，用完按「換人」。</span>
                  </span>
                </label>
                <label class="choice">
                  <input type="radio" name="dv-mode" checked={enroll.mode === "personal"} onChange={() => setEnroll({ ...enroll, mode: "personal" })} />
                  <span>
                    <b>個人平板</b>
                    <span class="meta">只給一位學生；登入一次就一直記住，直到老師在這裡登出這台。</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <p class="key-warn">設好之後，這台會登出老師帳號並打開學生登入頁。要再用老師帳號，重新登入就好。</p>
            <p class="login-msg error" role="status">
              {enroll.error}
            </p>
            <div class="form-actions">
              <button class="btn primary" type="submit">
                設成學生平板
              </button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={edit !== null} title={edit ? `管理 ${edit.device.name}` : ""} onClose={() => setEdit(null)}>
        {edit &&
          (edit.confirm ? (
            <div class="form">
              <p>
                登出「{edit.device.name}」之後，這台就不是學生平板了，在上面登入的學生也會一起登出。要再用，得重新用老師帳號設定。
              </p>
              <div class="form-actions spread">
                <button class="btn" onClick={() => setEdit({ ...edit, confirm: false })}>
                  取消
                </button>
                <button
                  class="btn danger"
                  onClick={async () => {
                    if (await act(() => request("DELETE", `devices/${edit.device.id}`), `已登出 ${edit.device.name}`)) setEdit(null);
                  }}
                >
                  確定登出這台
                </button>
              </div>
            </div>
          ) : (
            <form class="form" onSubmit={rename}>
              <div class="field">
                <label for="dv-rename">名字</label>
                <input
                  id="dv-rename"
                  required
                  maxLength={LIMITS.name}
                  pattern=".*\S.*"
                  value={edit.name}
                  onInput={(e) => setEdit({ ...edit, name: e.currentTarget.value })}
                  data-error="dv-rename-err"
                />
                <span class="error-msg" id="dv-rename-err">
                  請填寫名字（最多 {LIMITS.name} 字）。
                </span>
              </div>
              <div class="form-actions spread">
                <button type="button" class="btn quiet" onClick={() => setEdit({ ...edit, confirm: true })}>
                  登出這台
                </button>
                <button class="btn primary" type="submit">
                  儲存名字
                </button>
              </div>
            </form>
          ))}
      </Dialog>
    </>
  );
}
