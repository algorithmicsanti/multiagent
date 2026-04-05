"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resolveBrowserApiUrl } from "../../lib/api-url";
import {
  Actor,
  buildActorGroups,
  CENTRAL_ORCHESTRATOR_ID,
  TASK_TYPES,
} from "../shared/actor-utils";

export default function NewMissionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [actorsLoading, setActorsLoading] = useState(true);
  const [actorsError, setActorsError] = useState<string | null>(null);

  const [missionForm, setMissionForm] = useState({
    title: "",
    description: "",
    priority: 5,
    createdBy: "admin",
    budgetLimit: "",
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    instructions: "",
    agentType: "RESEARCH",
    requestedActorId: CENTRAL_ORCHESTRATOR_ID,
    timeoutSeconds: 300,
  });

  useEffect(() => {
    const controller = new AbortController();
    async function loadActors() {
      try {
        setActorsLoading(true);
        const res = await fetch(`${resolveBrowserApiUrl()}/api/v1/actors`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Failed to load actors");
        }
        const data = await res.json();
        setActors(data);
        setActorsError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setActorsError(err instanceof Error ? err.message : "Failed to load actors");
      } finally {
        setActorsLoading(false);
      }
    }
    loadActors();
    return () => controller.abort();
  }, []);

  const actorGroups = useMemo(
    () => buildActorGroups(actors, taskForm.agentType),
    [actors, taskForm.agentType]
  );
  const selectedActor = actors.find((actor) => actor.id === taskForm.requestedActorId) ?? null;
  const assignmentMode =
    taskForm.requestedActorId === CENTRAL_ORCHESTRATOR_ID ? "ORCHESTRATOR" : "DIRECT";
  const assignmentReady =
    !actorsLoading && !actorsError && (actors.length > 0 || assignmentMode === "ORCHESTRATOR");

  useEffect(() => {
    if (taskForm.requestedActorId === CENTRAL_ORCHESTRATOR_ID) return;
    if (selectedActor?.supportedAgentTypes.includes(taskForm.agentType)) return;

    const fallbackActor =
      actorGroups.humans[0]?.id ?? actorGroups.agents[0]?.id ?? CENTRAL_ORCHESTRATOR_ID;

    setTaskForm((current) => ({ ...current, requestedActorId: fallbackActor }));
  }, [actorGroups.agents, actorGroups.humans, selectedActor, taskForm.agentType, taskForm.requestedActorId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiUrl = resolveBrowserApiUrl();
      const missionRes = await fetch(`${apiUrl}/api/v1/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: missionForm.title,
          description: missionForm.description,
          priority: missionForm.priority,
          createdBy: missionForm.createdBy,
          budgetLimit: missionForm.budgetLimit ? Number(missionForm.budgetLimit) : undefined,
        }),
      });

      if (!missionRes.ok) {
        const payload = await missionRes.json();
        throw new Error(payload.error ?? "Failed to create mission");
      }

      const mission = await missionRes.json();

      const hasTaskInputs = Boolean(taskForm.title.trim() && taskForm.instructions.trim());
      const canCreateTask = assignmentReady && hasTaskInputs;

      if (!canCreateTask) {
        router.push(`/missions/${mission.id}/tasks/new`);
        return;
      }

      const taskRes = await fetch(`${apiUrl}/api/v1/missions/${mission.id}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: taskForm.title,
          instructions: taskForm.instructions,
          agentType: taskForm.agentType,
          assignmentMode,
          requestedActorId: taskForm.requestedActorId,
          timeoutSeconds: Number(taskForm.timeoutSeconds),
          dependsOn: [],
        }),
      });

      if (!taskRes.ok) {
        router.push(`/missions/${mission.id}/tasks/new`);
        return;
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
    <div className="main-content" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deploy New Mission</h1>
          <p className="data-label" style={{ marginTop: 10 }}>
            Define the mission and immediately choose who will execute the first task: a human, a
            specialist agent, or the Central Orchestrator.
          </p>
        </div>
      </div>

      <div className="isometric-card">
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {error && (
            <div
              style={{
                background: "rgba(255, 51, 102, 0.1)",
                border: "1px solid var(--red)",
                borderRadius: 4,
                padding: "12px 16px",
                color: "var(--red)",
                fontSize: 13,
                textTransform: "uppercase",
              }}
            >
              [ERROR] {error}
            </div>
          )}

          <div className="form-group">
            <label className="data-label" style={{ marginBottom: "8px", display: "block" }}>
              MISSION TITLE / DIRECTIVE *
            </label>
            <input
              className="form-input"
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "12px",
                width: "100%",
                borderRadius: "var(--radius-sm)",
                fontFamily: "inherit",
              }}
              required
              value={missionForm.title}
              onChange={(event) =>
                setMissionForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="e.g., Analyze competitor pricing and generate report"
            />
          </div>

          <div className="form-group">
            <label className="data-label" style={{ marginBottom: "8px", display: "block" }}>
              CONTEXT & PARAMETERS *
            </label>
            <textarea
              className="form-textarea"
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "12px",
                width: "100%",
                minHeight: "120px",
                borderRadius: "16px",
                fontFamily: "inherit",
              }}
              required
              value={missionForm.description}
              onChange={(event) =>
                setMissionForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Provide full context, data sources, and constraints for the agents..."
            />
          </div>

          <div
            className="grid-2"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}
          >
            <div className="form-group">
              <label
                className="data-label"
                style={{ marginBottom: "8px", display: "block", color: "var(--accent)" }}
              >
                PRIORITY LEVEL: {missionForm.priority}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={missionForm.priority}
                onChange={(event) =>
                  setMissionForm((current) => ({ ...current, priority: Number(event.target.value) }))
                }
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </div>

            <div className="form-group">
              <label className="data-label" style={{ marginBottom: "8px", display: "block" }}>
                MAX BUDGET (USD)
              </label>
              <input
                className="form-input"
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  padding: "12px",
                  width: "100%",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "inherit",
                }}
                type="number"
                step="0.01"
                min="0"
                value={missionForm.budgetLimit}
                onChange={(event) =>
                  setMissionForm((current) => ({ ...current, budgetLimit: event.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group" style={{ display: "none" }}>
            <input
              value={missionForm.createdBy}
              onChange={(event) =>
                setMissionForm((current) => ({ ...current, createdBy: event.target.value }))
              }
            />
          </div>

          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
            <h2 className="page-title" style={{ fontSize: 18, marginBottom: 12 }}>
              First Task Assignment
            </h2>
            <p className="data-label" style={{ marginBottom: 20 }}>
              Describe the very first task and decide who will handle it. The system will create the
              mission and immediately dispatch this assignment.
            </p>

            {actorsLoading && <p className="data-label">Loading actors and agents…</p>}
            {actorsError && (
              <p className="data-label" style={{ color: "var(--red)" }}>
                Unable to load actors automatically. You can still submit the mission and assign it
                manually on the next screen.
              </p>
            )}

            {!actorsLoading && !actorsError && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="form-group">
                  <label className="data-label" style={{ marginBottom: 8, display: "block" }}>
                    TASK TITLE *
                  </label>
                  <input
                    className="form-input"
                    style={{
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      padding: 12,
                      width: "100%",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "inherit",
                    }}
                    required
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="e.g. Run initial research brief"
                  />
                </div>

                <div className="form-group">
                  <label className="data-label" style={{ marginBottom: 8, display: "block" }}>
                    INSTRUCTIONS *
                  </label>
                  <textarea
                    className="form-textarea"
                    required
                    value={taskForm.instructions}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, instructions: event.target.value }))
                    }
                    placeholder="Describe expected output, constraints, format, deadlines…"
                    style={{ minHeight: 130 }}
                  />
                </div>

                <div
                  className="grid-2"
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
                >
                  <div className="form-group">
                    <label className="data-label" style={{ marginBottom: 8, display: "block" }}>
                      TASK TYPE
                    </label>
                    <select
                      value={taskForm.agentType}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, agentType: event.target.value }))
                      }
                      className="form-input"
                      style={{
                        background: "var(--bg3)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        padding: 12,
                        width: "100%",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "inherit",
                      }}
                    >
                      {TASK_TYPES.map((taskType) => (
                        <option key={taskType} value={taskType}>
                          {taskType}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="data-label" style={{ marginBottom: 8, display: "block" }}>
                      TIMEOUT (SECONDS)
                    </label>
                    <input
                      type="number"
                      min={30}
                      step={30}
                      value={taskForm.timeoutSeconds}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          timeoutSeconds: Number(event.target.value),
                        }))
                      }
                      className="form-input"
                      style={{
                        background: "var(--bg3)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        padding: 12,
                        width: "100%",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="data-label" style={{ marginBottom: 8, display: "block" }}>
                    WHO SHOULD HANDLE THIS TASK?
                  </label>
                  <select
                    value={taskForm.requestedActorId}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        requestedActorId: event.target.value,
                      }))
                    }
                    className="form-input"
                    style={{
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      padding: 12,
                      width: "100%",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "inherit",
                    }}
                  >
                    <optgroup label="Delegation">
                      {actorGroups.central.map((actor) => (
                        <option key={actor.id} value={actor.id}>
                          {actor.displayName} (smart delegation)
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
                    Mode:{" "}
                    {assignmentMode === "ORCHESTRATOR"
                      ? "Central orchestrator will select the best agent or human."
                      : "Direct assignment to the selected actor."}
                  </p>
                </div>

                {selectedActor && (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: 16,
                      background: "var(--bg2)",
                    }}
                  >
                    <div className="data-row" style={{ marginBottom: 10 }}>
                      <span className="data-label">ROLE</span>
                      <span className="data-value">{selectedActor.role}</span>
                    </div>
                    <div className="data-row" style={{ alignItems: "flex-start", gap: 16 }}>
                      <span className="data-label">CONTEXT</span>
                      <span className="data-value" style={{ textAlign: "right" }}>
                        {selectedActor.context}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px dashed var(--border)",
            }}
          >
            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{ background: "rgba(0, 240, 255, 0.1)", borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              {loading ? "DEPLOYING..." : "DEPLOY MISSION & ASSIGN"}
            </button>
            <Link href="/missions" className="btn" style={{ borderColor: "var(--text2)", color: "var(--text2)" }}>
              ABORT
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
