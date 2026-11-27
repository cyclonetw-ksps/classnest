import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { CARD_COUNT, PASSWORD_LENGTH } from "../shared/cards";
import { LIMITS, type KioskRoster, type StudentView } from "../shared/types";
import { localDate, weekdayOf, WEEKDAY_NAMES } from "../shared/week";
import { ApiError, request } from "./api";
import { CardPicture, cardName } from "./cards";
import { DiaryLines } from "./diary-lines";
import { Check } from "./icons";
import { paperAt } from "./palette";

type Phase = "loading" | "device" | "roster" | "me" | "error";
type Kid = KioskRoster["students"][number];

// 共用平板閒置多久自動換人（秒）：學生走開後，下一位不會看到前一位的分數
const IDLE_S = 90;

const paperStyle = (color: number) => {
  const p = color < 0 ? null : paperAt(color);
  return { "--paper": p?.hue ?? "var(--line-strong)", "--on-paper": p?.ink ?? "var(--ink)" };
};

// 寵物出來之前的頭像：名字第一個字，放在第一個所屬組別色紙的圓上
function Avatar({ name, color, size }: { name: string; color: number; size?: "big" }) {
  return (
    <span class={`avatar${size ? ` ${size}` : ""}`} style={paperStyle(color)} aria-hidden="true">
      {Array.from(name)[0] ?? ""}
    </span>
  );
}

// 學生平板（/student）：先點組別、再點自己的名字、依序點 3 張圖卡；登入後看自己的分數、獎勵與聯絡簿
export function StudentPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [roster, setRoster] = useState<KioskRoster | null>(null);
  const [me, setMe] = useState<StudentView | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await request<StudentView>("GET", "student/me"));
      setPhase("me");
      return;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) return setPhase("error");
    }
    try {
      setRoster(await request<KioskRoster>("GET", "student/roster"));
      setMe(null);
      setPhase("roster");
    } catch (err) {
      setPhase(err instanceof ApiError && err.status === 401 ? "device" : "error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 學生頁開著時每 15 秒更新一次：老師開放簽到後按鈕就會出現
  useEffect(() => {
    if (phase !== "me") return;
    const id = setInterval(() => document.visibilityState === "visible" && load(), 15_000);
    return () => clearInterval(id);
  }, [phase, load]);

  useEffect(() => {
    const title = me?.title ?? roster?.title;
    document.title = title ? `${title}｜學生` : "學生";
  }, [me?.title, roster?.title]);

  const signOut = useCallback(async () => {
    try {
      await request("POST", "student/logout");
    } finally {
      load();
    }
  }, [load]);

  if (phase === "loading") return <p class="center">載入中…</p>;
  if (phase === "error")
    return (
      <p class="center">
        連不上伺服器。
        <button class="btn" onClick={load}>
          再試一次
        </button>
      </p>
    );
  if (phase === "device")
    return (
      <main class="login">
        <h1>
          <span class="clause">這台</span>
          <span class="clause">還不是學生平板</span>
        </h1>
        <p class="muted">
          <span class="clause">請老師用這台登入，</span>
          <span class="clause">到「設定」裡的「學生平板」，</span>
          <span class="clause">按「把這台設成學生平板」。</span>
        </p>
        <a class="btn primary" href="/#settings">
          老師登入
        </a>
      </main>
    );
  if (phase === "me" && me) return <MePage me={me} onSignOut={signOut} onReload={load} />;
  if (roster) return <Picker roster={roster} onLogin={load} />;
  return null;
}

/* ---------- 選人與圖卡 ---------- */

function Picker({ roster, onLogin }: { roster: KioskRoster; onLogin: () => void }) {
  const [groupId, setGroupId] = useState<string | null>(roster.groups.length === 1 ? roster.groups[0].id : null);
  const [kid, setKid] = useState<Kid | null>(null);
  const group = roster.groups.find((g) => g.id === groupId) ?? null;
  const kids = group ? roster.students.filter((s) => s.groupIds.includes(group.id)) : [];
  const colorOf = (s: Kid) => roster.groups.find((g) => g.id === s.groupIds[0])?.color ?? -1;

  return (
    <div class="shell public kiosk">
      <header class="top">
        <h1 class="site-title">{roster.title}</h1>
        <span class="who">{roster.mode === "personal" ? "我的平板" : "學生平板"}</span>
      </header>
      <main class="sheet">
        {kid ? (
          <CardLogin kid={kid} color={colorOf(kid)} onBack={() => setKid(null)} onLogin={onLogin} />
        ) : group ? (
          <section class="kiosk-step" aria-labelledby="k-who">
            <div class="kiosk-head">
              <h2 id="k-who">點你的名字</h2>
              {roster.groups.length > 1 && (
                <button class="btn" onClick={() => setGroupId(null)}>
                  換一組
                </button>
              )}
            </div>
            <p class="kiosk-group" style={paperStyle(group.color)}>
              {group.name}
            </p>
            {kids.length === 0 ? (
              <p class="empty">這一組還沒有學生。</p>
            ) : (
              <ul class="kids">
                {kids.map((s) => (
                  <li key={s.id}>
                    <button class={`kid${s.ready ? "" : " not-ready"}`} disabled={!s.ready} onClick={() => setKid(s)}>
                      <Avatar name={s.displayName} color={colorOf(s)} />
                      <span class="kid-name">{s.displayName}</span>
                      {!s.ready && (
                        <span class="kid-note">
                          <span class="clause">還沒有圖卡，</span>
                          <span class="clause">請找老師</span>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section class="kiosk-step" aria-labelledby="k-group">
            <h2 id="k-group">你是哪一組？</h2>
            {roster.groups.length === 0 ? (
              <p class="empty">老師還沒有建立組別。</p>
            ) : (
              <ul class="kiosk-groups">
                {roster.groups.map((g) => (
                  <li key={g.id}>
                    <button class="kiosk-group-btn" style={paperStyle(g.color)} onClick={() => setGroupId(g.id)}>
                      {g.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function CardLogin({ kid, color, onBack, onLogin }: { kid: Kid; color: number; onBack: () => void; onLogin: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [msg, setMsg] = useState<{ text: string; locked?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  // 暫停時間到就自動恢復，不用重新整理
  useEffect(() => {
    if (!msg?.locked) return;
    const t = setTimeout(() => setMsg(null), LIMITS.cardLockMs);
    return () => clearTimeout(t);
  }, [msg]);

  async function tap(card: number) {
    if (busy || picked.includes(card) || picked.length >= PASSWORD_LENGTH) return;
    const next = [...picked, card];
    setPicked(next);
    setMsg(null);
    if (next.length < PASSWORD_LENGTH) return;
    setBusy(true);
    try {
      await request("POST", "student/login", { studentId: kid.id, cards: next });
      onLogin();
    } catch (err) {
      const locked = err instanceof ApiError && err.status === 429;
      setMsg({ text: err instanceof ApiError ? err.message : "連不上伺服器，再試一次", locked });
      setShake((n) => n + 1);
      setPicked([]);
      setBusy(false);
    }
  }

  return (
    <section class="kiosk-step" aria-labelledby="k-cards">
      <div class="kiosk-head">
        <div class="kiosk-me">
          <Avatar name={kid.displayName} color={color} />
          <h2 id="k-cards">{kid.displayName}</h2>
        </div>
        <button class="btn" onClick={onBack}>
          不是我
        </button>
      </div>
      <div class="card-pad">
      <p class="kiosk-ask">依序點你的 {PASSWORD_LENGTH} 張圖卡</p>
      <ol class="slots" aria-label={`已經點了 ${picked.length} 張`} key={shake} data-shake={shake > 0 ? "" : undefined}>
        {Array.from({ length: PASSWORD_LENGTH }, (_, i) => (
          <li key={i} class={picked[i] !== undefined ? "filled" : ""}>
            {picked[i] !== undefined ? <CardPicture index={picked[i]} /> : <span class="slot-no">{i + 1}</span>}
          </li>
        ))}
      </ol>
      <p class={`kiosk-msg${msg ? " error" : ""}`} role="status">
        {msg?.text}
      </p>
      {msg?.locked && (
        <div class="kiosk-foot">
          <button class="btn primary" onClick={onBack}>
            回到選名字
          </button>
        </div>
      )}
      <ul class="pic-grid">
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <li key={i}>
            <button class="pic" disabled={busy || msg?.locked || picked.includes(i)} aria-pressed={picked.includes(i)} onClick={() => tap(i)}>
              <CardPicture index={i} />
              <span>{cardName(i)}</span>
            </button>
          </li>
        ))}
      </ul>
      {picked.length > 0 && !busy && (
        <div class="kiosk-foot">
          <button class="btn" onClick={() => setPicked([])}>
            重來
          </button>
        </div>
      )}
      </div>
    </section>
  );
}

/* ---------- 學生自己的頁面 ---------- */

// 簽到：老師開放中才出現；簽好後共用平板幾秒後自動換下一位
const NEXT_S = 5;

function CheckinCard({ me, onSignOut, onReload }: { me: StudentView; onSignOut: () => void; onReload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justDone, setJustDone] = useState(false);
  const shared = me.mode === "shared";

  useEffect(() => {
    if (!justDone || !shared) return;
    const t = setTimeout(onSignOut, NEXT_S * 1000);
    return () => clearTimeout(t);
  }, [justDone, shared, onSignOut]);

  if (!me.checkin.open && !justDone) return null;
  if (me.checkin.checkedIn || justDone)
    return (
      <p class="checkin-done" role="status">
        <Check />
        <span>
          <span class="clause">簽到好了！</span>
          {justDone && shared && <span class="clause">{NEXT_S} 秒後換下一位。</span>}
        </span>
      </p>
    );
  return (
    <div class="checkin-cta">
      <button
        class="btn primary checkin-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await request("POST", "student/checkin");
            setJustDone(true);
            onReload();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "連不上伺服器，再按一次");
            onReload();
          } finally {
            setBusy(false);
          }
        }}
      >
        我來了，簽到
      </button>
      <p class="kiosk-msg error" role="status">
        {error}
      </p>
    </div>
  );
}

function MePage({ me, onSignOut, onReload }: { me: StudentView; onSignOut: () => void; onReload: () => void }) {
  const shared = me.mode === "shared";
  // 共用平板：一陣子沒動就自動換人
  const timer = useRef<number>();
  useEffect(() => {
    if (!shared) return;
    const arm = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(onSignOut, IDLE_S * 1000) as unknown as number;
    };
    arm();
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of events) addEventListener(e, arm, { passive: true });
    return () => {
      clearTimeout(timer.current);
      for (const e of events) removeEventListener(e, arm);
    };
  }, [shared, onSignOut]);

  const next = me.rewards.find((r) => !r.unlocked);
  const ready = me.rewards.filter((r) => r.unlocked && !r.granted);
  const got = me.rewards.filter((r) => r.granted);
  const today = localDate(new Date());

  return (
    <div class="shell public kiosk">
      <header class="top">
        <h1 class="site-title">{me.title}</h1>
        <button class="btn ghost" onClick={onSignOut}>
          {shared ? "換人" : "登出"}
        </button>
      </header>
      <main class="sheet me">
        <CheckinCard me={me} onSignOut={onSignOut} onReload={onReload} />
        <section class="me-card" style={{ ...paperStyle(me.color), "--pin": me.color < 0 ? "var(--paper-red)" : paperAt(me.color).hue }} aria-labelledby="me-name">
          <span class="pin drop me-pin" aria-hidden="true" />
          <div class="me-who">
            <Avatar name={me.displayName} color={me.color} size="big" />
            <h2 id="me-name">嗨，{me.displayName}</h2>
          </div>
          <p class="me-total">
            <span class="visually-hidden">我的分數</span>
            {me.total}
            <small>分</small>
          </p>
          {next ? (
            <div class="me-next">
              <label for="me-progress">
                再 <b>{next.threshold - me.total}</b> 分：{next.title}
              </label>
              <progress id="me-progress" max={next.threshold} value={me.total} />
            </div>
          ) : (
            me.rewards.length > 0 && <p class="me-next">所有的獎勵都解鎖了！</p>
          )}
        </section>

        {(ready.length > 0 || got.length > 0) && (
          <section aria-labelledby="me-rewards">
            <h2 id="me-rewards" class="pub-section-title">
              我的獎勵
            </h2>
            <ul class="me-rewards">
              {ready.map((r) => (
                <li key={r.id} class="ribbon">
                  可以找老師領：{r.title}
                </li>
              ))}
              {got.map((r) => (
                <li key={r.id} class="ribbon granted">
                  <Check />
                  已經拿到：{r.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        {me.diary.length > 0 && (
          <section aria-labelledby="me-diary">
            <h2 id="me-diary" class="pub-section-title">
              聯絡簿
            </h2>
            <ol class="diary-list">
              {me.diary.map((d) => (
                <li key={`${d.date}-${d.groupId}`} class="diary-entry" style={paperStyle(d.color)}>
                  <div class="diary-head">
                    <h3>{d.groupName}</h3>
                    <span class="pub-diary-date">
                      {WEEKDAY_NAMES[weekdayOf(d.date)] ?? ""} {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))}
                      {d.date === today && <span class="tt-today">今天</span>}
                    </span>
                  </div>
                  <DiaryLines homework={d.homework} bring={d.bring} note={d.note} />
                  {d.myNote && (
                    <p class="my-note">
                      <b>老師給你的話</b>
                      {d.myNote}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
        {shared && (
          <p class="hint kiosk-hint">
            <span class="clause">用完請按右上角「換人」；</span>
            <span class="clause">{IDLE_S} 秒沒動也會自動換人。</span>
          </p>
        )}
      </main>
    </div>
  );
}
