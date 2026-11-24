import { useState } from "preact/hooks";
import type { ClassState, PointEvent, Student } from "../shared/types";
import { request } from "./api";
import type { Act } from "./App";
import { Dialog } from "./Dialog";

type Target = { kind: "student"; student: Student } | { kind: "group"; groupId: string; name: string; count: number };

function timeOf(ms: number) {
  return new Date(ms).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PointsPanel({ state, act }: { state: ClassState; act: Act }) {
  const [groupId, setGroupId] = useState<string>("");
  const [target, setTarget] = useState<Target | null>(null);
  const groups = state.groups.filter((g) => g.active);
  const reasons = state.reasons.filter((r) => r.active);
  const pendingRewards = (s: Student) => s.rewards.filter((r) => r.unlocked && r.grantedAt === null).length;
  const students = state.students.filter((s) => s.active && (!groupId || s.groupIds.includes(groupId)));
  const group = groups.find((g) => g.id === groupId);

  async function award(reasonId: string) {
    if (!target) return;
    const reason = reasons.find((r) => r.id === reasonId)!;
    const body = target.kind === "student" ? { reasonId, studentIds: [target.student.id] } : { reasonId, groupId: target.groupId };
    const who = target.kind === "student" ? target.student.displayName : `${target.name}（${target.count} 人）`;
    setTarget(null);
    await act(() => request("POST", "points", body), `已替 ${who} 加 ${reason.points} 分：${reason.label}`);
  }

  return (
    <section aria-labelledby="points-title">
      <h2 id="points-title" class="visually-hidden">
        加分
      </h2>
      {groups.length > 0 && (
        <div class="chips" role="group" aria-label="篩選組別">
          <button class="chip" aria-pressed={groupId === ""} onClick={() => setGroupId("")}>
            全部
          </button>
          {groups.map((g) => (
            <button key={g.id} class="chip" aria-pressed={groupId === g.id} onClick={() => setGroupId(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {reasons.length === 0 && <p class="hint">還沒有加分理由。先到「加分理由」新增，例如「寫完作業 +2」。</p>}

      {group && students.length > 0 && reasons.length > 0 && (
        <button class="btn primary wide" onClick={() => setTarget({ kind: "group", groupId: group.id, name: group.name, count: students.length })}>
          替整組加分（{group.name}，{students.length} 人）
        </button>
      )}

      {students.length === 0 ? (
        <p class="hint">{state.students.length === 0 ? "還沒有學生。先到「學生」新增名單。" : "這組目前沒有學生。"}</p>
      ) : (
        <ul class="student-grid">
          {students.map((s) => (
            <li key={s.id}>
              <button
                class="student-card"
                disabled={reasons.length === 0}
                onClick={() => setTarget({ kind: "student", student: s })}
                aria-label={`替 ${s.displayName} 加分，目前 ${s.total} 分`}
              >
                <span class="name">{s.displayName}</span>
                <span class="total">{s.total}</span>
                <span class="unit">分</span>
                {pendingRewards(s) > 0 && <span class="badge">可領 {pendingRewards(s)} 項獎勵</span>}
              </button>
            </li>
          ))}
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
              <button class="reason-btn" autoFocus={i === 0} onClick={() => award(r.id)}>
                <span class="pts">+{r.points}</span>
                {r.label}
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
        {events.map((e) => (
          <li key={e.id} class={e.undoneAt ? "undone" : ""}>
            <span class="what">
              <strong>{e.studentName}</strong> +{e.points} {e.reasonLabel}
            </span>
            <span class="meta">
              {timeOf(e.createdAt)}・{e.teacherEmail.split("@")[0]}
            </span>
            {e.undoneAt ? (
              <span class="meta">已撤銷</span>
            ) : (
              <button
                class="btn small"
                aria-label={`撤銷 ${e.studentName} 的 +${e.points} ${e.reasonLabel}`}
                onClick={() => act(() => request("POST", `points/${e.id}/undo`), `已撤銷 ${e.studentName} 的 ${e.points} 分`)}
              >
                撤銷
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
