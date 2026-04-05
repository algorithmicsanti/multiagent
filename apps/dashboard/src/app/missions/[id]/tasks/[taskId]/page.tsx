import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTimeCDMX } from "../../../../lib/datetime";
import { resolveServerApiUrl } from "../../../../lib/api-url";
import { ManualTaskForm } from "./manual-task-form";

const API_URL = resolveServerApiUrl();

async function getTask(taskId: string) {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function getTaskRuns(taskId: string) {
  const res = await fetch(`${API_URL}/api/v1/tasks/${taskId}/runs`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const [task, runs] = await Promise.all([getTask(taskId), getTaskRuns(taskId)]);

  if (!task) notFound();

  const canSubmitManualResult =
    task.resolvedActor?.kind === "HUMAN" &&
    (task.status === "WAITING_RESULT" || task.status === "RUNNING");

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: "8px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", flexWrap: "wrap" }}>
            <Link href="/missions" style={{ textDecoration: "none", color: "var(--text2)" }}>NETWORK</Link>
            <span style={{ color: "var(--text2)" }}>/</span>
            <Link href={`/missions/${id}`} style={{ textDecoration: "none", color: "var(--text2)" }}>MISSION</Link>
            <span style={{ color: "var(--accent)" }}>/</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>TASK TRACE</span>
          </div>
          <h1 className="page-title">{task.title}</h1>
        </div>
        <span className={`badge badge-${task.status.toLowerCase()}`}>{task.status}</span>
      </div>

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div className="isometric-card">
          <h3 className="card-title" style={{ marginBottom: 16, color: "var(--accent)" }}>Assignment</h3>
          <div className="data-row">
            <span className="data-label">MODE</span>
            <span className="data-value">{task.assignmentMode}</span>
          </div>
          <div className="data-row">
            <span className="data-label">TASK TYPE</span>
            <span className="data-value">{task.agentType}</span>
          </div>
          <div className="data-row">
            <span className="data-label">REQUESTED</span>
            <span className="data-value">{task.requestedActor?.displayName ?? "Unassigned"}</span>
          </div>
          <div className="data-row">
            <span className="data-label">RESOLVED</span>
            <span className="data-value">{task.resolvedActor?.displayName ?? "Pending"}</span>
          </div>
          {task.assignmentReason && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border)" }}>
              <div className="data-label" style={{ marginBottom: 6 }}>REASON</div>
              <div className="data-value">{task.assignmentReason}</div>
            </div>
          )}
        </div>

        <div className="isometric-card">
          <h3 className="card-title" style={{ marginBottom: 16, color: "var(--accent)" }}>Task Instructions</h3>
          <div className="data-value" style={{ whiteSpace: "pre-wrap" }}>
            {task.instructions}
          </div>
        </div>
      </div>

      {canSubmitManualResult && (
        <ManualTaskForm taskId={task.id} actorName={task.resolvedActor.displayName} />
      )}

      <div className="diagram-canvas">
        {runs.length === 0 ? (
          <div className="empty-state">
            <p>No execution cycles logged for this task yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {runs.map((run: {
              id: string;
              status: string;
              workerName: string;
              startedAt: string;
              finishedAt?: string;
              durationMs?: number;
              tokensUsed?: number;
              costUsd?: string;
              errorMessage?: string;
              outputPayload?: unknown;
            }, index: number) => (
              <div key={run.id} style={{ position: "relative" }}>
                {index > 0 && <div className="connection-line vertical" style={{ height: "32px", top: "-32px", left: "20px" }}></div>}
                <div className="isometric-card" style={{ borderColor: run.status === "FAILED" ? "var(--red)" : "var(--accent)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 16, gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`badge badge-${run.status.toLowerCase()}`}>{run.status}</span>
                      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, letterSpacing: 1 }}>{run.workerName}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text2)", textAlign: "right" }}>
                      STARTED: {formatDateTimeCDMX(run.startedAt)}
                      {run.finishedAt && <div>FINISHED: {formatDateTimeCDMX(run.finishedAt)}</div>}
                      {run.durationMs && <div>TIME: {(run.durationMs / 1000).toFixed(1)}s</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 32, marginBottom: 16, flexWrap: "wrap" }}>
                    {run.tokensUsed != null && (
                      <div className="data-row">
                        <span className="data-label">LLM TOKENS:</span>
                        <span className="data-value">{run.tokensUsed}</span>
                      </div>
                    )}
                    {run.costUsd != null && (
                      <div className="data-row">
                        <span className="data-label">COMPUTE COST:</span>
                        <span className="data-value">${Number(run.costUsd).toFixed(4)}</span>
                      </div>
                    )}
                  </div>

                  {run.errorMessage && (
                    <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px dashed var(--red)", borderRadius: 8, padding: "12px", fontSize: 11, color: "var(--red)", marginBottom: 16, fontFamily: "monospace" }}>
                      {run.errorMessage}
                    </div>
                  )}

                  {run.outputPayload != null && (
                    <div>
                      <div className="data-label" style={{ marginBottom: 8 }}>OUTPUT PAYLOAD</div>
                      <pre style={{ background: "rgba(0, 0, 0, 0.04)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, fontSize: 11, overflowX: "auto", maxHeight: 400, color: "var(--text)", borderLeft: "2px solid var(--accent)" }}>
                        {JSON.stringify(run.outputPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
