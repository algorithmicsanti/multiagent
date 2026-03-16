import Link from "next/link";
import { formatDateTimeCDMX } from "../../../../lib/datetime";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  const runs = await getTaskRuns(taskId);

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: "8px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            <Link href="/missions" style={{ textDecoration: "none", color: "var(--text2)" }}>NETWORK</Link>
            <span style={{ color: "var(--text2)" }}>/</span>
            <Link href={`/missions/${id}`} style={{ textDecoration: "none", color: "var(--text2)" }}>NODE: {id.substring(0, 8)}</Link>
            <span style={{ color: "var(--accent)" }}>/</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>TASK TRACE</span>
          </div>
          <h1 className="page-title">Agent Trace Logs</h1>
        </div>
      </div>

      <div className="agent-status-banner" style={{ background: "rgba(0, 0, 0, 0.4)", borderLeftColor: "var(--text2)", color: "var(--text2)" }}>
        <span><strong>Trace Explorer:</strong> Examining execution instances for task <span style={{ color: "var(--accent)" }}>{taskId}</span></span>
      </div>

      <div className="diagram-canvas">
        {runs.length === 0 ? (
          <div className="empty-state">
            <p>NO EXECUTION CYCLES LOGGED FOR THIS TASK YET.</p>
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
            }, i: number) => (
              <div key={run.id} style={{ position: "relative" }}>
                {i > 0 && <div className="connection-line vertical" style={{ height: "32px", top: "-32px", left: "20px" }}></div>}
                <div className="isometric-card" style={{ borderColor: run.status === "FAILED" ? "var(--red)" : "var(--accent)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 16 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <span className={`badge badge-${run.status.toLowerCase()}`}>{run.status}</span>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, letterSpacing: 1 }}>{run.workerName}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text2)", textAlign: "right" }}>
                      TRACED: {formatDateTimeCDMX(run.startedAt)}
                      {run.durationMs && <div>TIME: {(run.durationMs / 1000).toFixed(1)}s</div>}
                    </div>
                  </div>

                  <div className="grid-2" style={{ display: "flex", gap: 32, marginBottom: 16 }}>
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
                    <div style={{ background: "rgba(255, 51, 102, 0.1)", border: "1px dashed var(--red)", borderRadius: "2px", padding: "12px", fontSize: 11, color: "var(--red)", marginBottom: 16, fontFamily: "monospace" }}>
                      [FATAL ERROR] {run.errorMessage}
                    </div>
                  )}

                  {run.outputPayload != null && (
                    <div>
                      <div className="data-label" style={{ marginBottom: 8 }}>ARTIFACT OUTPUT:</div>
                      <pre style={{ background: "rgba(0, 0, 0, 0.4)", border: "1px solid var(--border)", borderRadius: "2px", padding: "16px", fontSize: 11, overflowX: "auto", maxHeight: 400, color: "var(--text)", borderLeft: "2px solid var(--accent)" }}>
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
