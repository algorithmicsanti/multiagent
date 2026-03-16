import Link from "next/link";
import { ResetMissionsButton } from "./ResetMissionsButton";
import { formatDateTimeCDMX } from "../lib/datetime";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("Missing API URL. Set API_INTERNAL_URL or NEXT_PUBLIC_API_URL.");
}

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
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return { data: [], pagination: { total: 0 } };
    return res.json();
  } catch (e) {
    console.error("Fail fetching API:", e);
    return { data: [], pagination: { total: 0 } };
  }
}

const FLOW_STEPS = ["NEW", "PLANNING", "DISPATCHING", "RUNNING", "REVIEWING", "DONE"];

function getFlowProgress(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "WAITING_APPROVAL") {
    return { currentStep: "WAITING APPROVAL", completedIndex: 3 };
  }
  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return { currentStep: normalized, completedIndex: FLOW_STEPS.indexOf("RUNNING") };
  }

  const idx = FLOW_STEPS.indexOf(normalized);
  if (idx >= 0) {
    return { currentStep: normalized, completedIndex: idx };
  }

  return { currentStep: normalized, completedIndex: 0 };
}

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const { data: missions } = await getMissions(params.status);

  const statuses = ["NEW", "PLANNING", "DISPATCHING", "RUNNING", "REVIEWING", "WAITING_APPROVAL", "DONE", "FAILED"];

  return (
    <div className="main-content">
      <div className="page-header">
        <h1 className="page-title">Agent Missions Explorer</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <ResetMissionsButton />
          <Link href="/missions/new" className="btn">
            NEW MISSION
          </Link>
        </div>
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
              const flow = getFlowProgress(m.status);
              
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
                          <span className="data-label">CREATED:</span>
                          <span className="data-value">{formatDateTimeCDMX(m.createdAt)}</span>
                        </div>

                        <div className="hover-flow">
                          <div className="hover-flow-title">PIPELINE</div>
                          <div className="hover-flow-steps">
                            {FLOW_STEPS.map((step, idx) => {
                              const stateClass = idx < flow.completedIndex
                                ? "done"
                                : idx === flow.completedIndex
                                  ? "active"
                                  : "pending";

                              return (
                                <span key={step} className={`hover-flow-step ${stateClass}`}>
                                  {step}
                                </span>
                              );
                            })}
                          </div>
                          <div className="data-row" style={{ marginBottom: 0 }}>
                            <span className="data-label">NOW:</span>
                            <span className="data-value">{flow.currentStep}</span>
                          </div>
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
