import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
    <div>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 4, fontSize: 13 }}>
            <Link href="/missions" style={{ color: "var(--text2)", textDecoration: "none" }}>Missions</Link>
            <span style={{ color: "var(--text2)", margin: "0 6px" }}>/</span>
            <Link href={`/missions/${id}`} style={{ color: "var(--text2)", textDecoration: "none" }}>Mission</Link>
            <span style={{ color: "var(--text2)", margin: "0 6px" }}>/</span>
            <span>Task Runs</span>
          </div>
          <h1 className="page-title">Task Runs</h1>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No runs yet</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          }) => (
            <div key={run.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className={`badge badge-${run.status}`}>{run.status}</span>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{run.workerName}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>
                  {new Date(run.startedAt).toLocaleString()}
                  {run.durationMs && ` • ${(run.durationMs / 1000).toFixed(1)}s`}
                  {run.tokensUsed && ` • ${run.tokensUsed} tokens`}
                  {run.costUsd && ` • $${Number(run.costUsd).toFixed(4)}`}
                </div>
              </div>

              {run.errorMessage && (
                <div style={{ background: "#3a1a1a", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#f87171", marginBottom: 12 }}>
                  {run.errorMessage}
                </div>
              )}

              {run.outputPayload && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>OUTPUT</div>
                  <pre style={{ background: "var(--bg3)", borderRadius: 6, padding: "10px 12px", fontSize: 11, overflow: "auto", maxHeight: 400, color: "var(--text)" }}>
                    {JSON.stringify(run.outputPayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
