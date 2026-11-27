import { useEffect, useState } from "preact/hooks";
import type { ClassState, LoginCards } from "../shared/types";
import { ApiError, getState, request } from "./api";
import { cardName, CardPicture } from "./cards";
import { paperAt } from "./palette";

// 印圖卡密碼（/cards）：老師登入後才看得到；一位學生一格，剪下來發給學生
export function PrintCards() {
  const [data, setData] = useState<{ state: ClassState; cards: LoginCards[] } | null>(null);
  const [phase, setPhase] = useState<"loading" | "login" | "error" | "ready">("loading");

  useEffect(() => {
    Promise.all([getState(), request<LoginCards[]>("GET", "login-cards")])
      .then(([state, cards]) => {
        setData({ state, cards });
        setPhase("ready");
        document.title = `${state.title}｜圖卡密碼`;
      })
      .catch((err) => setPhase(err instanceof ApiError && err.status === 401 ? "login" : "error"));
  }, []);

  if (phase === "loading") return <p class="center">載入中…</p>;
  if (phase === "login")
    return (
      <main class="login">
        <h1>請先登入</h1>
        <p class="muted">圖卡密碼只有老師看得到。</p>
        <a class="btn primary" href="/">
          老師登入
        </a>
      </main>
    );
  if (phase === "error" || !data) return <p class="center">連不上伺服器，請重新整理。</p>;

  const groups = data.state.groups;
  const colorOf = (ids: string[]) => {
    const i = groups.findIndex((g) => g.id === ids[0]);
    return i < 0 ? "var(--line-strong)" : paperAt(i).hue;
  };
  const names = (ids: string[]) => ids.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join("、");

  return (
    <div class="print-page">
      <header class="print-head">
        <h1>{data.state.title}｜圖卡密碼</h1>
        <p class="hint">
          <span class="clause">在學生平板上點自己的名字，</span>
          <span class="clause">再依照 1、2、3 的順序點圖卡。</span>
          <span class="clause">剪下來發給每位學生，</span>
          <span class="clause">收好不要給別人看。</span>
        </p>
        <button class="btn primary" onClick={() => print()}>
          列印
        </button>
      </header>
      {data.cards.length === 0 ? (
        <p class="empty">還沒有學生有圖卡密碼。請到「學生」替學生產生。</p>
      ) : (
        <ul class="print-grid">
          {data.cards.map((s) => (
            <li key={s.studentId} class="print-slip" style={{ "--paper": colorOf(s.groupIds) }}>
              <p class="slip-name">
                <b>{s.displayName}</b>
                <span class="meta">{names(s.groupIds)}</span>
              </p>
              <ol class="card-seq">
                {s.cards.map((c, i) => (
                  <li key={i}>
                    <span class="seq-no">{i + 1}</span>
                    <CardPicture index={c} />
                    <span>{cardName(c)}</span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
