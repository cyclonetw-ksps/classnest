import { useState } from "preact/hooks";
import { LIMITS, type ClassState } from "../shared/types";
import { request } from "./api";
import type { Act } from "./App";
import { CopyButton } from "./copy";
import { Dialog } from "./Dialog";

const dateOf = (ms: number) => new Date(ms).toLocaleDateString("zh-TW", { year: "numeric", month: "numeric", day: "numeric" });

// agent 金鑰：讓 AI agent 用 MCP 寫公布欄。金鑰只在產生時顯示一次，伺服器只存雜湊
export function AgentKeys({ state, act }: { state: ClassState; act: Act }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const endpoint = `${location.origin}/api/mcp`;
  const command = fresh ? `claude mcp add --scope user --transport http classnest ${endpoint} --header "Authorization: Bearer ${fresh.key}"` : "";

  return (
    <>
      <h3>agent 金鑰（MCP）</h3>
      <p class="hint">
        讓 Claude 等 AI agent 透過 MCP 幫你寫公布欄。每個 agent 產生一把；金鑰只能讀寫面板、卡片和讀組別名稱，看不到學生、分數與獎勵。不用了就停用，立刻失效。
      </p>
      <form
        class="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          let created: { name: string; key: string } | null = null;
          const ok = await act(async () => {
            created = await request<{ id: string; name: string; key: string }>("POST", "agent-keys", { name });
          });
          if (ok && created) {
            setFresh(created);
            setName("");
          }
        }}
      >
        <label for="k-name" class="visually-hidden">
          金鑰名稱
        </label>
        <input
          id="k-name"
          required
          pattern=".*\S.*"
          maxLength={LIMITS.keyName}
          autoComplete="off"
          placeholder="金鑰名稱，例如：筆電上的 Claude"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button class="btn primary" type="submit">
          產生金鑰
        </button>
      </form>
      <ul class="rows">
        {state.agentKeys.map((k) => (
          <li key={k.id} class={k.active ? "" : "inactive"}>
            <div class="row-main">
              <strong>{k.name}</strong>
              <span class="meta">
                {dateOf(k.createdAt)} 產生｜{k.lastUsedAt ? `${dateOf(k.lastUsedAt)} 最後使用` : "還沒用過"}
                {!k.active && "｜已停用"}
              </span>
            </div>
            <button
              class="btn small"
              aria-label={`${k.active ? "停用" : "啟用"}金鑰「${k.name}」`}
              onClick={() => act(() => request("PATCH", `agent-keys/${k.id}`, { active: !k.active }), k.active ? `已停用金鑰「${k.name}」` : `已啟用金鑰「${k.name}」`)}
            >
              {k.active ? "停用" : "啟用"}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={fresh !== null} title={`金鑰「${fresh?.name ?? ""}」`} onClose={() => setFresh(null)} wide>
        {fresh && (
          <div class="form key-view">
            <p class="key-warn">金鑰只會出現這一次。關掉這個視窗前，先複製貼到 agent 的設定裡。</p>
            <div class="field">
              <span class="field-label">金鑰</span>
              <code class="secret">{fresh.key}</code>
              <CopyButton text={fresh.key} label="複製金鑰">
                複製金鑰
              </CopyButton>
            </div>
            <div class="field">
              <span class="field-label">MCP 網址</span>
              <code class="secret">{endpoint}</code>
              <CopyButton text={endpoint} label="複製 MCP 網址">
                複製網址
              </CopyButton>
            </div>
            <div class="field">
              <span class="field-label">Claude Code 一行設定</span>
              <code class="secret">
                {command.split(" ").map((part, i) => (
                  <>
                    {i > 0 && " "}
                    {/* 參數名稱（--scope、--header）不要從連字號中間斷行 */}
                    {part.startsWith("--") ? <span class="nobr">{part}</span> : part}
                  </>
                ))}
              </code>
              <CopyButton text={command} label="複製設定指令">
                複製指令
              </CopyButton>
            </div>
            <p class="hint">
              這行指令在終端機執行一次，之後每個資料夾開的 Claude Code 都能用。其他 agent：MCP 種類選 Streamable HTTP，標頭加上 Authorization: Bearer 金鑰。
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
