import { useCallback, useEffect, useState } from "preact/hooks";
import type { PublicView } from "../shared/types";
import { ApiError, request } from "./api";
import { boardPaper, Note } from "./notes";
import { paperAt } from "./palette";

type Phase = "loading" | "pin" | "ready" | "gone" | "error";

// 分享頁（/s/<代碼>）：代課老師、學生、家長看分享的面板。不用登入；可能要通關碼。
export function PublicPage({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<PublicView | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [group, setGroup] = useState(() => decodeURIComponent(location.hash.slice(1)));

  const load = useCallback(
    async (p: string, g: string) => {
      try {
        const v = await request<PublicView>("POST", `public/${encodeURIComponent(code)}`, { pin: p || undefined, group: g || undefined });
        setView(v);
        setPinError("");
        setPhase("ready");
        return true;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
          setPinError(p ? err.message : "");
          setPhase("pin");
        } else if (err instanceof ApiError && err.status === 404) setPhase("gone");
        else setPhase("error");
        return false;
      }
    },
    [code],
  );

  useEffect(() => {
    load(pin, group);
    // 只在打開時載入；之後由切組與回到頁面時重新載入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && phase === "ready" && load(pin, group);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, pin, group, load]);

  useEffect(() => {
    document.title = view?.title ? `${view.title}｜公布欄` : "公布欄";
  }, [view?.title]);

  function pick(g: string) {
    setGroup(g);
    history.replaceState(null, "", g ? `#${encodeURIComponent(g)}` : location.pathname);
    load(pin, g);
  }

  if (phase === "loading") return <p class="center">載入中…</p>;
  if (phase === "gone")
    return (
      <main class="login">
        <h1>連結已失效</h1>
        <p class="muted">這個分享連結已經換新或打錯了，請向老師索取新的連結。</p>
      </main>
    );
  if (phase === "error")
    return (
      <p class="center">
        連不上伺服器。
        <button class="btn" onClick={() => load(pin, group)}>
          再試一次
        </button>
      </p>
    );
  if (phase === "pin")
    return (
      <main class="login">
        <h1>輸入通關碼</h1>
        <p class="muted">老師給的 4 位數字</p>
        <form
          class="pin-form"
          onSubmit={(e) => {
            e.preventDefault();
            load(pin, group);
          }}
        >
          <label for="pub-pin" class="visually-hidden">
            通關碼
          </label>
          <input
            id="pub-pin"
            class="pin-input"
            inputMode="numeric"
            autoComplete="off"
            required
            pattern="\d{4}"
            maxLength={4}
            autoFocus
            value={pin}
            onInput={(e) => setPin(e.currentTarget.value)}
            aria-describedby={pinError ? "pub-pin-err" : undefined}
            aria-invalid={pinError ? "true" : undefined}
          />
          <button class="btn primary" type="submit">
            打開
          </button>
        </form>
        <p class="login-msg" id="pub-pin-err" role="status">
          {pinError}
        </p>
      </main>
    );
  if (!view) return null;

  const colorOf = (id: string) => view.groups.find((g) => g.id === id)?.color ?? -1;
  const groupName = (id: string) => view.groups.find((g) => g.id === id)?.name ?? "";

  return (
    <div class="shell public">
      <header class="top">
        <h1 class="site-title">{view.title}</h1>
        <span class="who">公布欄</span>
      </header>
      <main class="sheet">
        {view.groups.length > 0 && (
          <div class="labels" role="group" aria-label="看哪一組">
            <button type="button" class="label" aria-pressed={!group} onClick={() => pick("")}>
              全部
            </button>
            {view.groups.map((g) => {
              const p = paperAt(g.color);
              return (
                <button key={g.id} type="button" class="label" style={{ "--paper": p.hue, "--on-paper": p.ink }} aria-pressed={group === g.id} onClick={() => pick(g.id)}>
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        {view.boards.length === 0 ? (
          <p class="empty">老師還沒有分享內容{group ? "給這一組" : ""}。</p>
        ) : (
          <ol class="boards">
            {view.boards.map((b) => (
              <li key={b.id} class="board-col" style={{ "--paper": boardPaper(b.groupIds, colorOf).hue }}>
                <header class="board-strip">
                  <h2>{b.title}</h2>
                  <p class="board-meta">
                    <span class="board-groups">{b.groupIds.length ? b.groupIds.map(groupName).filter(Boolean).join("、") : "全班"}</span>
                  </p>
                </header>
                {b.cards.length === 0 ? (
                  <p class="board-blank">還沒有內容</p>
                ) : (
                  <ol class="notes">
                    {b.cards.map((c) => (
                      <li key={c.id}>
                        <Note card={c} level={3} />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
