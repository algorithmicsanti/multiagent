"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveBrowserApiUrl } from "../../../../lib/api-url";
import {
  Actor,
  buildActorGroups,
  CENTRAL_ORCHESTRATOR_ID,
  TASK_TYPES,
} from "../../../shared/actor-utils";

type MissionTask = {
  id: string;
  title: string;
  status: string;
};

type Mission = {
  id: string;
  title: string;
  tasks: MissionTask[];
};

export function NewTaskForm({ mission, actors }: { mission: Mission; actors: Actor[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    instructions: "",
    agentType: "RESEARCH",
    requestedActorId: CENTRAL_ORCHESTRATOR_ID,
    timeoutSeconds: 300,
    dependsOn: [] as string[],
  });

  const actorGroups = useMemo(() => buildActorGroups(actors, form.agentType), [actors, form.agentType]);
  const selectedActor = actors.find((actor) => actor.id === form.requestedActorId) ?? null;
  const assignmentMode = form.requestedActorId === CENTRAL_ORCHESTRATOR_ID ? "ORCHESTRATOR" : "DIRECT";

  useEffect(() => {
    if (form.requestedActorId === CENTRAL_ORCHESTRATOR_ID) return;
    if (selectedActor?.supportedAgentTypes.includes(form.agentType)) return;

    const nextDirectActor =
      actorGroups.humans[0]?.id ??
      actorGroups.agents[0]?.id ??
      CENTRAL_ORCHESTRATOR_ID;

    setForm((current) => ({ ...current, requestedActorId: nextDirectActor }));
  }, [actorGroups.agents, actorGroups.humans, form.agentType, form.requestedActorId, selectedActor]);

  const toggleDependency = (taskId: string) => {
    setForm((current) => ({
      ...current,
      dependsOn: current.dependsOn.includes(taskId)
        ? current.dependsOn.filter((item) => item !== taskId)
        : [...current.dependsOn, taskId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${resolveBrowserApiUrl()}/api/v1/missions/${mission.id}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          instructions: form.instructions,
          agentType: form.agentType,
          assignmentMode,
          requestedActorId: form.requestedActorId,
          timeoutSeconds: Number(form.timeoutSeconds),
          dependsOn: form.dependsOn,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to create task");
      }

      router.push(`/missions/${mission.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 980 }}>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            <Link href={`/missions/${mission.id}`} style={{ textDecoration: "none", color: "var(--accent)" }}>
              MISSION NODE
            </Link>
            <span style={{ color: "var(--text2)" }}>/</span>
            <span style={{ color: "var(--text2)" }}>NEW TASK</span>
          </div>
          <h1 className="page-title">Create Assignable Task</h1>
          <p className="data-label" style={{ marginTop: 10 }}>
            Mission: {mission.title}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="isometric-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--red)", borderRadius: 12, padding: "12px 16px", color: "var(--red)" }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="data-label" style={{ display: "block", marginBottom: 8 }}>TASK TITLE *</label>
          <input
            className="form-input"
            style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)", padding: 12, width: "100%", borderRadius: "var(--radius-sm)", fontFamily: "inherit" }}
            required
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="e.g. Diseñar el flujo móvil de asignación"
          />
        </div>

        <div className="form-group">
          <label className="data-label" style={{ display: "block", marginBottom: 8 }}>INSTRUCTIONS *</label>
          <textarea
            className="form-textarea"
            required
            value={form.instructions}
            onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
            placeholder="Describe qué debe entregar el ejecutor, restricciones, formato esperado y contexto adicional."
            style={{ minHeight: 140 }}
          />
        </div>

        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div className="form-group">
            <label className="data-label" style={{ display: "block", marginBottom: 8 }}>TASK TYPE</label>
            <select
              value={form.agentType}
              onChange={(event) => setForm((current) => ({ ...current, agentType: event.target.value }))}
              className="form-input"
              style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)", padding: 12, width: "100%", borderRadius: "var(--radius-sm)", fontFamily: "inherit" }}
            >
              {TASK_TYPES.map((taskType) => (
                <option key={taskType} value={taskType}>
                  {taskType}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="data-label" style={{ display: "block", marginBottom: 8 }}>TIMEOUT (SECONDS)</label>
            <input
              type="number"
              min={30}
              step={30}
              value={form.timeoutSeconds}
              onChange={(event) => setForm((current) => ({ ...current, timeoutSeconds: Number(event.target.value) }))}
              className="form-input"
              style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)", padding: 12, width: "100%", borderRadius: "var(--radius-sm)", fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="data-label" style={{ display: "block", marginBottom: 8 }}>WHO SHOULD HANDLE THIS TASK?</label>
          <select
            value={form.requestedActorId}
            onChange={(event) => setForm((current) => ({ ...current, requestedActorId: event.target.value }))}
            className="form-input"
            style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)", padding: 12, width: "100%", borderRadius: "var(--radius-sm)", fontFamily: "inherit" }}
          >
            <optgroup label="Delegation">
              {actorGroups.central.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName} (recommended for smart delegation)
                </option>
              ))}
            </optgroup>
            <optgroup label="Humans">
              {actorGroups.humans.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </optgroup>
            <optgroup label="Agents">
              {actorGroups.agents.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="data-label" style={{ marginTop: 8 }}>
            Mode: {assignmentMode === "ORCHESTRATOR" ? "The central orchestrator will choose the best actor." : "Direct assignment to the selected actor."}
          </p>
        </div>

        {selectedActor && (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16, background: "var(--bg2)" }}>
            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">ROLE</span>
              <span className="data-value">{selectedActor.role}</span>
            </div>
            <div className="data-row" style={{ alignItems: "flex-start", gap: 16 }}>
              <span className="data-label">CONTEXT</span>
              <span className="data-value" style={{ textAlign: "right" }}>{selectedActor.context}</span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="data-label" style={{ display: "block", marginBottom: 10 }}>DEPENDENCIES</label>
          {mission.tasks.length === 0 ? (
            <div className="data-label">This mission has no prior tasks yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {mission.tasks.map((task) => (
                <label
                  key={task.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    border: "1px solid var(--border)",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: form.dependsOn.includes(task.id) ? "rgba(91, 66, 243, 0.08)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.dependsOn.includes(task.id)}
                    onChange={() => toggleDependency(task.id)}
                  />
                  <span className="data-value" style={{ flex: 1 }}>{task.title}</span>
                  <span className={`badge badge-${task.status.toLowerCase()}`}>{task.status}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "CREATING..." : "CREATE TASK"}
          </button>
          <Link href={`/missions/${mission.id}`} className="btn">
            BACK TO MISSION
          </Link>
        </div>
      </form>
    </div>
  );
}
