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
    <div>
      <div className="page-header">
        <h1 className="page-title">Missions</h1>
        <Link href="/missions/new" className="btn btn-primary">+ New Mission</Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Link href="/missions" className={`btn btn-ghost ${!params.status ? "btn-primary" : ""}`} style={{ fontSize: 12 }}>All</Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/missions?status=${s}`}
            className={`btn btn-ghost ${params.status === s ? "btn-primary" : ""}`}
            style={{ fontSize: 12 }}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="card">
        {missions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No missions found</div>
            <p>Create your first mission to get started.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Tasks</th>
                <th>Created by</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(missions as Mission[]).map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/missions/${m.id}`} className="link">{m.title}</Link>
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                  <td><span className="priority-badge">P{m.priority}</span></td>
                  <td>{m._count?.tasks ?? 0}</td>
                  <td style={{ color: "var(--text2)" }}>{m.createdBy}</td>
                  <td style={{ color: "var(--text2)", fontSize: 12 }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text2)" }}>
        {pagination.total} total missions
      </div>
    </div>
  );
}
