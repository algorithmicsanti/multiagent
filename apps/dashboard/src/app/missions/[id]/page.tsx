import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getMission(id: string) {
  const res = await fetch(`${API_URL}/api/v1/missions/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function getMissionEvents(id: string) {
  const res = await fetch(`${API_URL}/api/v1/missions/${id}/events?limit=100`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [mission, events] = await Promise.all([getMission(id), getMissionEvents(id)]);

  if (!mission) notFound();

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link href="/missions" style={{ color: "var(--text2)", textDecoration: "none", fontSize: 13 }}>
              Missions
            </Link>
            <span style={{ color: "var(--text2)", margin: "0 6px" }}>/</span>
            <span style={{ fontSize: 13 }}>{mission.title}</span>
          </div>
          <h1 className="page-title">{mission.title}</h1>
        </div>
        <StatusBadge status={mission.status} />
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text2)" }}>MISSION INFO</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>{mission.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div><span style={{ color: "var(--text2)" }}>Priority:</span> P{mission.priority}</div>
            <div><span style={{ color: "var(--text2)" }}>Created by:</span> {mission.createdBy}</div>
            <div><span style={{ color: "var(--text2)" }}>Created:</span> {new Date(mission.createdAt).toLocaleString()}</div>
            {mission.budgetLimit && <div><span style={{ color: "var(--text2)" }}>Budget:</span> ${mission.budgetLimit}</div>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text2)" }}>ARTIFACTS ({mission.artifacts?.length ?? 0})</h3>
          {mission.artifacts?.length === 0 ? (
            <p style={{ color: "var(--text2)", fontSize: 12 }}>No artifacts yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mission.artifacts?.map((a: { id: string; artifactType: string; pathOrUrl: string }) => (
                <div key={a.id} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge badge-${a.artifactType.toLowerCase()}`}>{a.artifactType}</span>
                  <span style={{ color: "var(--text2)", fontFamily: "monospace" }}>{a.pathOrUrl}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--text2)" }}>TASKS ({mission.tasks?.length ?? 0})</h3>
        {mission.tasks?.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No tasks yet. The orchestrator will generate tasks once the mission is picked up.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Retries</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mission.tasks?.map((t: { id: string; title: string; agentType: string; status: string; retries: number; requiresApproval: boolean }) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td><span className="badge badge-planning">{t.agentType}</span></td>
                  <td><StatusBadge status={t.status} /></td>
                  <td style={{ color: "var(--text2)", fontSize: 12 }}>{t.retries}</td>
                  <td>
                    <Link href={`/missions/${id}/tasks/${t.id}`} className="link" style={{ fontSize: 12 }}>
                      View runs
                    </Link>
                    {t.requiresApproval && <span className="badge badge-waiting_approval" style={{ marginLeft: 8 }}>needs approval</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--text2)" }}>EVENT TIMELINE ({events.length})</h3>
        {events.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No events yet</p>
        ) : (
          <div className="timeline">
            {events.map((e: { id: string; eventType: string; createdAt: string; payload: unknown }) => (
              <div key={e.id} className="timeline-item">
                <span className="timeline-time">{new Date(e.createdAt).toLocaleTimeString()}</span>
                <span className="timeline-type">{e.eventType}</span>
                <span className="timeline-payload">{JSON.stringify(e.payload).slice(0, 120)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
