import { useCallback, useEffect, useState } from "preact/hooks";
import type { ClassState } from "../shared/types";
import { ApiError, getConfig, getState, logout } from "./api";
import { BoardPanel } from "./BoardPanel";
import { Login } from "./Login";
import { PointsPanel } from "./PointsPanel";
import { ReasonsPanel, RewardsPanel } from "./RewardsPanel";
import { GroupsPanel, StudentsPanel } from "./RosterPanel";
import { SettingsPanel } from "./SettingsPanel";

export type Act = (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

const TABS = [
  { id: "points", label: "加分" },
  { id: "board", label: "公布欄" },
  { id: "students", label: "學生" },
  { id: "groups", label: "組別" },
  { id: "reasons", label: "加分理由" },
  { id: "rewards", label: "獎勵" },
  { id: "settings", label: "設定" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function initialTab(): TabId {
  const h = location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? "points") as TabId;
}

export function App() {
  const [config, setConfig] = useState<{ title: string; googleClientId: string } | null>(null);
  const [state, setState] = useState<ClassState | null>(null);
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [tab, setTab] = useState<TabId>(initialTab);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getState();
      setState(s);
      setPhase("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setPhase("login");
      else setPhase("error");
    }
  }, []);

  useEffect(() => {
    getConfig()
      .then((c) => setConfig(c))
      .catch(() => setConfig({ title: "班級", googleClientId: "" }));
    refresh();
  }, [refresh]);

  useEffect(() => {
    const title = state?.title ?? config?.title;
    if (title) document.title = title;
  }, [state?.title, config?.title]);

  useEffect(() => {
    const onHash = () => setTab(initialTab());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const act: Act = useCallback(
    async (fn, done) => {
      try {
        await fn();
        await refresh();
        if (done) setNotice({ kind: "ok", text: done });
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setPhase("login");
          return false;
        }
        setNotice({ kind: "error", text: (err as Error).message });
        return false;
      }
    },
    [refresh],
  );

  if (phase === "loading" || !config) return <p class="center muted">載入中…</p>;
  if (phase === "login") return <Login title={config.title} clientId={config.googleClientId} onLoggedIn={refresh} />;
  if (phase === "error" || !state) {
    return (
      <p class="center">
        連不上伺服器。<button class="btn" onClick={refresh}>再試一次</button>
      </p>
    );
  }

  return (
    <div class="shell">
      <header class="top">
        <h1 class="site-title">{state.title}</h1>
        <div class="who">
          <span class="muted">{state.me.name}</span>
          <button
            class="btn ghost"
            onClick={async () => {
              await logout().catch(() => {});
              setState(null);
              setPhase("login");
            }}
          >
            登出
          </button>
        </div>
      </header>
      <nav class="tabs" aria-label="功能">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} class="tab" aria-current={tab === t.id ? "page" : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      <p role="status" class={`notice ${notice?.kind ?? ""}`} hidden={!notice}>
        {notice?.text}
        {notice && (
          <button class="btn ghost small" onClick={() => setNotice(null)}>
            知道了
          </button>
        )}
      </p>
      <main class="sheet">
        {tab === "points" && <PointsPanel state={state} act={act} />}
        {tab === "board" && <BoardPanel state={state} act={act} />}
        {tab === "students" && <StudentsPanel state={state} act={act} />}
        {tab === "groups" && <GroupsPanel state={state} act={act} />}
        {tab === "reasons" && <ReasonsPanel state={state} act={act} />}
        {tab === "rewards" && <RewardsPanel state={state} act={act} />}
        {tab === "settings" && <SettingsPanel state={state} act={act} />}
      </main>
    </div>
  );
}
