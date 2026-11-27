import { useCallback, useEffect, useState } from "preact/hooks";
import type { PublicDiary, PublicView } from "../shared/types";
import { localDate, weekdayOf, WEEKDAY_NAMES } from "../shared/week";
import { ApiError, getConfig, request } from "./api";
import { DiaryLines } from "./diary-lines";
import { boardPaper, Note } from "./notes";
import { paperAt } from "./palette";

type Phase = "loading" | "pin" | "ready" | "gone" | "error";

// 分享頁（/s/<代碼>）：代課老師、學生、家長看分享的面板。不用登入；可能要通關碼。
export function PublicPage({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<PublicView | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [group, setGroup] = useState(() => {
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return "";
    }
  });
  // 通關碼畫面也要看得出是哪個班：網站標題本來就公開
  const [siteTitle, setSiteTitle] = useState("");
  useEffect(() => {
    getConfig()
      .then((c) => setSiteTitle(c.title))
      .catch(() => {});
  }, []);

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
          setPinError(p || err.status === 429 ? (err.status === 429 ? err.message : `${err.message}，請再試一次；連錯太多次要等幾分鐘。`) : "");
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
        {siteTitle && <p class="login-site">{siteTitle}</p>}
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
        {siteTitle && <p class="login-site">{siteTitle}</p>}
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
        <p class={`login-msg${pinError ? " error" : ""}`} id="pub-pin-err" role="status">
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
        {view.diary.length > 0 && <PublicDiaryList diary={view.diary} colorOf={colorOf} groupName={groupName} />}
        {view.boards.length === 0 ? (
          view.diary.length === 0 && <p class="empty">老師還沒有分享內容{group ? "給這一組" : ""}。</p>
        ) : (
          <section class="pub-boards" aria-labelledby={view.diary.length > 0 ? "pub-boards-title" : undefined}>
          {view.diary.length > 0 && (
            <h2 id="pub-boards-title" class="pub-section-title">
              公布欄
            </h2>
          )}
          <ol class="boards">
            {view.boards.map((b) => {
              const Title = view.diary.length > 0 ? "h3" : "h2";
              return (
              <li key={b.id} class="board-col" style={{ "--paper": boardPaper(b.groupIds, colorOf).hue }}>
                <header class="board-strip">
                  <Title>{b.title}</Title>
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
                        <Note card={c} level={view.diary.length > 0 ? 4 : 3} />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
              );
            })}
          </ol>
          </section>
        )}
      </main>
    </div>
  );
}

// 聯絡簿：一天一段（新的在前），每組一張紙；沒有個別加註，也沒有是誰寫的
function PublicDiaryList(props: { diary: PublicDiary[]; colorOf: (id: string) => number; groupName: (id: string) => string }) {
  const dates = [...new Set(props.diary.map((d) => d.date))];
  const today = localDate(new Date());
  return (
    <section class="pub-diary" aria-labelledby="pub-diary-title">
      <h2 id="pub-diary-title" class="pub-section-title">
        聯絡簿
      </h2>
      {dates.map((date) => (
        <div key={date} class="pub-diary-day">
          <h3 class="pub-diary-date">
            {WEEKDAY_NAMES[weekdayOf(date)] ?? ""} {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
            {date === today && <span class="tt-today">今天</span>}
          </h3>
          <ol class="diary-list">
            {props.diary
              .filter((d) => d.date === date)
              .map((d) => (
                <li key={d.groupId} class="diary-entry" style={{ "--paper": paperAt(props.colorOf(d.groupId)).hue }}>
                  <div class="diary-head">
                    <h4 class="diary-group">{props.groupName(d.groupId)}</h4>
                  </div>
                  <DiaryLines homework={d.homework} bring={d.bring} note={d.note} />
                </li>
              ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
