import Link from "next/link";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Mission {
  id: string;
  title: string;
  status: string;
  priority: number;
  createdBy: string;
  createdAt: string;
  _count?: { tasks: number };
}

async function getMissions(status?: string) {
  const url = new URL(`${API_URL}/api/v1/missions`);
  if (status) url.searchParams.set("status", status);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return { data: [], pagination: { total: 0 } };
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const { data: missions, pagination } = await getMissions(params.status);

  const statuses = ["NEW", "PLANNING", "DISPATCHING", "RUNNING", "REVIEWING", "WAITING_APPROVAL", "DONE", "FAILED"];

  return (
    <div className="main-content">
      <div className="page-header">
        <h1 className="page-title">Agent Missions Explorer</h1>
        <Link href="/missions/new" className="btn">
          NEW MISSION
        </Link>
      </div>

      <div className="agent-status-banner">
        <div className="pulse"></div>
        <span><strong>Web Mentor OS:</strong> Scanning network for active assignments and tasks...</span>
      </div>

      <div className="filters">
        <Link href="/missions" className={`filter-btn ${!params.status ? "active" : ""}`}>ALL MISSIONS</Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/missions?status=${s}`}
            className={`filter-btn ${params.status === s ? "active" : ""}`}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="diagram-canvas">
        {missions.length === 0 ? (
          <div className="empty-state">
            <p>No active missions found in the system.</p>
          </div>
        ) : (
          <div className="missions-flow">
            {(missions as Mission[]).map((m) => {
              const badgeClass = `badge-${m.status.toLowerCase()}`;
              
              return (
                <div key={m.id} className="mission-node">
                  <Link href={`/missions/${m.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className="connection-line vertical"></div>
                    <div className="isometric-card">
                      <div className="card-header">
                        <span className="card-title">{m.title}</span>
                      </div>
                      
                      <div className="data-row">
                        <span className="data-label">AGENT STATUS:</span>
                        <span className={`badge ${badgeClass}`}>{m.status}</span>
                      </div>
                      
                      <div className="card-details">
                        <div className="data-row">
                          <span className="data-label">PRIORITY:</span>
                          <span className="data-value">P{m.priority}</span>
                        </div>
                        <div className="data-row">
                          <span className="data-label">CREATED:</span>
                          <span className="data-value">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="data-row">
                          <span className="data-label">ID:</span>
                          <span className="data-value" style={{fontFamily: 'monospace', fontSize: '10px'}}>{m.id.substring(0, 8)}</span>
                        </div>
                        <div className="data-row">
                          <span className="data-label">TASKS:</span>
                          <span className="data-value">{m._count?.tasks ?? 0} total</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
