import { useState } from "preact/hooks";
import type { ClassState, PointEvent, Student } from "../shared/types";
import { request } from "./api";
import type { Act } from "./App";
import { Dialog } from "./Dialog";
import { Check, Undo } from "./icons";
import { paperAt } from "./palette";

type Target = { kind: "student"; student: Student } | { kind: "group"; groupId: string; name: string; count: number };

function timeOf(ms: number) {
  return new Date(ms).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PointsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [groupId, setGroupId] = useState<string>("");
  const [target, setTarget] = useState<Target | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const groups = state.groups.filter((g) => g.active);
  const reasons = state.reasons.filter((r) => r.active);
  const groupIndex = (id: string) => state.groups.findIndex((g) => g.id === id);
  // 理由改名或刪除後，舊圖釘用中性色，不冒充第一個理由的顏色
  const pinColor = (label: string) => {
    const i = state.reasons.findIndex((r) => r.label === label);
    return i < 0 ? "var(--line-strong)" : paperAt(i).hue;
  };
  const pendingRewards = (s: Student) =>
    s.rewards.filter((r) => r.unlocked && r.grantedAt === null).map((r) => state.rewards.find((w) => w.id === r.rewardId)?.title ?? "");

  const active = state.students.filter((s) => s.active);
  // 選了某組：這組排前面，其他組的卡變淡但留在原地，老師知道還有誰
  const inGroup = (s: Student) => !groupId || s.groupIds.includes(groupId);
  const ordered = groupId ? [...active.filter(inGroup), ...active.filter((s) => !inGroup(s))] : active;
  const members = active.filter(inGroup);
  const group = groups.find((g) => g.id === groupId);
  const setupDone = groups.length > 0 && reasons.length > 0 && active.length > 0;

  const hueOf = (s: Student) => {
    const gid = groupId && s.groupIds.includes(groupId) ? groupId : s.groupIds.find((id) => groups.some((g) => g.id === id));
    return gid ? paperAt(groupIndex(gid)).hue : "var(--line-strong)";
  };
  const pinsOf = (s: Student) => state.events.filter((e) => e.studentId === s.id && !e.undoneAt).slice(0, 3);

  async function award(reasonId: string) {
    if (!target) return;
    const reason = reasons.find((r) => r.id === reasonId)!;
    const body = target.kind === "student" ? { reasonId, studentIds: [target.student.id] } : { reasonId, groupId: target.groupId };
    const who = target.kind === "student" ? target.student.displayName : `${target.name}（${target.count} 人）`;
    setTarget(null);
    let created: string[] = [];
    const ok = await act(async () => {
      const res = await request<{ events: PointEvent[] }>("POST", "points", body);
      created = res.events.map((e) => e.id);
    }, `已替 ${who} 加 ${reason.points} 分：${reason.label}`);
    if (ok) setFresh(new Set(created));
  }

  return (
    <section aria-labelledby="points-title" class="board">
      <h2 id="points-title" class="visually-hidden">
        加分
      </h2>
      <div class="board-head">
        {groups.length > 0 && active.length > 0 && (
          <div class="labels" role="group" aria-label="篩選組別">
            <button class="label" aria-pressed={groupId === ""} onClick={() => setGroupId("")}>
              全部
            </button>
            {groups.map((g) => {
              const p = paperAt(groupIndex(g.id));
              return (
                <button key={g.id} class="label" style={{ "--paper": p.hue, "--on-paper": p.ink }} aria-pressed={groupId === g.id} onClick={() => setGroupId(g.id)}>
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        {group && members.length > 0 && reasons.length > 0 && (
          <button class="btn primary" onClick={() => setTarget({ kind: "group", groupId: group.id, name: group.name, count: members.length })}>
            替整組加分（{members.length} 人）
          </button>
        )}
      </div>

      {!setupDone && <SetupSteps groups={groups.length > 0} reasons={reasons.length > 0} students={active.length > 0} />}

      {setupDone && active.length === 0 ? (
        <p class="empty">目前沒有啟用中的學生。到「學生」重新啟用或新增。</p>
      ) : active.length === 0 ? null : (
        <ul class="cards">
          {ordered.map((s) => {
            const pending = pendingRewards(s);
            return (
              <li key={s.id} class={inGroup(s) ? "" : "dim"}>
                <button
                  class="student"
                  style={{ "--paper": hueOf(s) }}
                  disabled={reasons.length === 0}
                  onClick={() => setTarget({ kind: "student", student: s })}
                  aria-label={`替 ${s.displayName} 加分，目前 ${s.total} 分${pending.length ? `，可領 ${pending.join("、")}` : ""}`}
                >
                  <span class="student-head">
                    <span class="name">{s.displayName}</span>
                    <span class="pins" aria-hidden="true">
                      {pinsOf(s).map((e) => (
                        <i key={e.id} class={`pin ${fresh.has(e.id) ? "drop" : ""}`} style={{ "--pin": pinColor(e.reasonLabel) }} />
                      ))}
                    </span>
                  </span>
                  <span class="total">
                    {s.total}
                    <small>分</small>
                  </span>
                  <span class="ribbon-slot">
                    {pending.length > 0 && (
                      <span class="ribbon">
                        <span class="ribbon-text">可領：{pending[0]}{pending.length > 1 ? ` 等 ${pending.length} 項` : ""}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={target !== null}
        title={target?.kind === "student" ? `替 ${target.student.displayName} 加分` : target ? `替 ${target.name} 每人加分` : ""}
        onClose={() => setTarget(null)}
      >
        <ul class="reason-list">
          {reasons.map((r, i) => (
            <li key={r.id}>
              <button class="reason" autoFocus={i === 0} onClick={() => award(r.id)}>
                <i class="pin" style={{ "--pin": paperAt(state.reasons.indexOf(r)).hue }} aria-hidden="true" />
                <span class="label-text">{r.label}</span>
                <span class="pts">+{r.points}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      <RecentEvents events={state.events} act={act} />
    </section>
  );
}

function RecentEvents({ events, act }: { events: PointEvent[]; act: Act }) {
  if (!events.length) return null;
  return (
    <section class="recent" aria-labelledby="recent-title">
      <h2 id="recent-title">最近的加分</h2>
      <ul>
        {events.slice(0, 12).map((e) => (
          <li key={e.id} class={e.undoneAt ? "undone" : ""}>
            <span class="what">
              <strong>{e.studentName}</strong> {e.reasonLabel} <span class="pts">+{e.points}</span>
            </span>
            <span class="meta">
              {timeOf(e.createdAt)}・{e.teacherEmail.split("@")[0]}
            </span>
            {e.undoneAt ? (
              <span class="meta">已撤銷</span>
            ) : (
              <button
                class="btn quiet small"
                aria-label={`撤銷 ${e.studentName} 的 ${e.reasonLabel} +${e.points}`}
                onClick={() => act(() => request("POST", `points/${e.id}/undo`), `已撤銷 ${e.studentName} 的 ${e.points} 分`)}
              >
                <Undo />
                撤銷
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// 空的布告欄：三張釘上去的步驟卡，按下去直接到那一頁；三步都完成就不再出現
function SetupSteps(props: { groups: boolean; reasons: boolean; students: boolean }) {
  const steps = [
    { done: props.groups, href: "#groups", title: "建立組別", body: "例如「國語五年級組」。同一位學生可以在好幾組。", paper: 0 },
    { done: props.reasons, href: "#reasons", title: "設定加分理由", body: "例如「寫完作業 +2」「主動幫忙 +3」，上課按一下就加分。", paper: 1 },
    { done: props.students, href: "#students", title: "加入學生", body: "只要顯示名、原班、導師稱呼，再勾選所屬組別。", paper: 2 },
  ];
  const left = steps.filter((s) => !s.done).length;
  return (
    <section class="setup" aria-labelledby="setup-title">
      <h2 id="setup-title">先把布告欄布置好</h2>
      <p class="hint">還差 {left} 步。完成後，這裡會變成每位學生的紙卡，按一下就能加分。</p>
      <ol class="steps">
        {steps.map((s, i) => (
          <li key={s.href}>
            <a class={`step ${s.done ? "done" : ""}`} href={s.href} style={{ "--paper": paperAt(s.paper).hue }}>
              <i class="pin" style={{ "--pin": paperAt(s.paper).hue }} aria-hidden="true" />
              <span class="step-no" aria-hidden="true">{i + 1}</span>
              <span class="step-title">{s.title}</span>
              <span class="step-body">{s.body}</span>
              <span class="step-state">
                {s.done ? (
                  <>
                    <Check />
                    已完成
                  </>
                ) : (
                  "前往設定"
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
