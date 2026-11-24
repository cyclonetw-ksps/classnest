import { useState } from "preact/hooks";
import { LIMITS, type ClassState } from "../shared/types";
import { request } from "./api";
import type { Act } from "./App";
import { Check } from "./icons";

export function ReasonsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("1");

  return (
    <section aria-labelledby="reasons-title">
      <h2 id="reasons-title">加分理由</h2>
      <p class="hint">每個理由有自己的分數，加分時按一下就好。分數只會增加，不會扣分。</p>
      <form
        class="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(() => request("POST", "reasons", { label, points: Number(points) }), `已新增理由 ${label.trim()}`);
          if (ok) {
            setLabel("");
            setPoints("1");
          }
        }}
      >
        <label for="r-label" class="visually-hidden">
          理由
        </label>
        <input id="r-label" required maxLength={LIMITS.name} pattern=".*\S.*" placeholder="例如：寫完作業" value={label} onInput={(e) => setLabel(e.currentTarget.value)} />
        <label for="r-points" class="visually-hidden">
          分數
        </label>
        <input id="r-points" class="num" type="number" inputMode="numeric" required min={1} max={LIMITS.maxPoints} step={1} value={points} onInput={(e) => setPoints(e.currentTarget.value)} />
        <span class="unit-label">分</span>
        <button class="btn primary" type="submit">
          新增理由
        </button>
      </form>
      <ul class="rows">
        {state.reasons.map((r) => (
          <li key={r.id} class={r.active ? "" : "inactive"}>
            <div class="row-main">
              <strong>
                +{r.points} {r.label}
              </strong>
              {!r.active && <span class="meta">已停用</span>}
            </div>
            <div class="row-actions">
              <button
                class="btn small"
                aria-label={`${r.active ? "停用" : "啟用"} ${r.label}`}
                onClick={() => act(() => request("PATCH", `reasons/${r.id}`, { active: !r.active }), r.active ? `已停用 ${r.label}` : `已啟用 ${r.label}`)}
              >
                {r.active ? "停用" : "啟用"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RewardsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [threshold, setThreshold] = useState("");
  const [title, setTitle] = useState("");
  const active = state.students.filter((s) => s.active);

  return (
    <section aria-labelledby="rewards-title">
      <h2 id="rewards-title">分數門檻與獎勵</h2>
      <p class="hint">學生累積分達到門檻就解鎖獎勵；發完後按「已發放」。撤銷加分讓分數掉到門檻以下時，獎勵會改回未解鎖。</p>
      <form
        class="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(() => request("POST", "rewards", { threshold: Number(threshold), title }), `已新增獎勵 ${title.trim()}`);
          if (ok) {
            setThreshold("");
            setTitle("");
          }
        }}
      >
        <label for="w-th" class="visually-hidden">
          門檻分數
        </label>
        <input id="w-th" class="num" type="number" inputMode="numeric" required min={1} max={LIMITS.maxThreshold} step={1} placeholder="分數" value={threshold} onInput={(e) => setThreshold(e.currentTarget.value)} />
        <span class="unit-label">分</span>
        <label for="w-title" class="visually-hidden">
          獎勵內容
        </label>
        <input id="w-title" required maxLength={LIMITS.rewardTitle} pattern=".*\S.*" placeholder="例如：自己選座位一次" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
        <button class="btn primary" type="submit">
          新增獎勵
        </button>
      </form>

      {state.rewards.map((w) => {
        const unlocked = active.filter((s) => s.rewards.find((r) => r.rewardId === w.id)?.unlocked);
        return (
          <article key={w.id} class={`reward ${w.active ? "" : "inactive"}`} aria-labelledby={`w-${w.id}`}>
            <div class="section-head">
              <h3 id={`w-${w.id}`}>
                <span class="threshold">{w.threshold} 分</span> {w.title}
              </h3>
              <button
                class="btn small"
                onClick={() => act(() => request("PATCH", `rewards/${w.id}`, { active: !w.active }), w.active ? `已停用 ${w.title}` : `已啟用 ${w.title}`)}
              >
                {w.active ? "停用" : "啟用"}
              </button>
            </div>
            {w.active &&
              (unlocked.length === 0 ? (
                <p class="meta">還沒有學生達到。</p>
              ) : (
                <ul class="rows compact">
                  {unlocked.map((s) => {
                    const grantedAt = s.rewards.find((r) => r.rewardId === w.id)?.grantedAt ?? null;
                    return (
                      <li key={s.id}>
                        <div class="row-main">
                          <strong>{s.displayName}</strong>
                          <span class={`ribbon ${grantedAt ? "granted" : ""}`}>
                            {grantedAt && <Check />}
                            <span class="ribbon-text">
                              {s.total} 分・{grantedAt ? "已發放" : "可以發放"}
                            </span>
                          </span>
                        </div>
                        <button
                          class={`btn small ${grantedAt ? "" : "primary"}`}
                          onClick={() =>
                            act(
                              () => request("POST", `rewards/${w.id}/${grantedAt ? "ungrant" : "grant"}`, { studentId: s.id }),
                              grantedAt ? `已取消 ${s.displayName} 的發放紀錄` : `已記錄發給 ${s.displayName}：${w.title}`,
                            )
                          }
                        >
                          {grantedAt ? "取消發放" : "標記已發放"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </article>
        );
      })}
    </section>
  );
}
