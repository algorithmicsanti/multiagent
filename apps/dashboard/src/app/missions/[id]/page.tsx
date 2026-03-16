import Link from "next/link";
import { notFound } from "next/navigation";
import MissionLiveLog from "./MissionLiveLog";
import { formatDateTimeCDMX, formatTimeCDMX } from "../../lib/datetime";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

function extractRequestedFormat(mission: { metadata?: unknown }) {
  const metadata = mission.metadata;
  if (!metadata || typeof metadata !== "object") return null;

  const record = metadata as Record<string, unknown>;
  const maybeFormat = record.requestedFormat ?? record.outputFormat ?? record.format;
  return typeof maybeFormat === "string" ? maybeFormat : null;
}

function extractSummaryFromEvents(events: Array<{ payload: unknown }>) {
  const reversed = [...events].reverse();
  for (const event of reversed) {
    if (!event.payload || typeof event.payload !== "object") continue;
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.summary === "string") return payload.summary;
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const badgeClass = `badge-${status.toLowerCase()}`;
  return <span className={`badge ${badgeClass}`}>{status}</span>;
}

function getTaskRouting(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;

  const record = metadata as Record<string, unknown>;
  if (!record.routedByPlanner) return null;

  const originalAgentType = typeof record.originalAgentType === "string"
    ? record.originalAgentType
    : null;
  const executionAgentType = typeof record.executionAgentType === "string"
    ? record.executionAgentType
    : null;

  if (!originalAgentType && !executionAgentType) return null;

  return { originalAgentType, executionAgentType };
}

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [mission, events] = await Promise.all([getMission(id), getMissionEvents(id)]);

  if (!mission) notFound();

  const isCompleted = mission.status === "DONE";
  const requestedFormat = extractRequestedFormat(mission);
  const latestArtifact = mission.artifacts?.[0] ?? null;
  const eventSummary = extractSummaryFromEvents(events as Array<{ payload: unknown }>);

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: "8px" }}>
            <Link href="/missions" style={{ textDecoration: "none", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--accent)" }}>
              ◄ BACK TO NETWORK
            </Link>
          </div>
          <h1 className="page-title">{mission.title}</h1>
        </div>
        <StatusBadge status={mission.status} />
      </div>

      {isCompleted && (
        <div className="isometric-card" style={{ marginBottom: 28, borderLeft: "3px solid var(--green)" }}>
          <h3 className="card-title" style={{ color: "var(--green)", marginBottom: 12 }}>FINAL RESULT</h3>
          <div className="data-row" style={{ marginBottom: 10 }}>
            <span className="data-label">REQUESTED FORMAT:</span>
            <span className="data-value">{requestedFormat ?? (latestArtifact?.artifactType ?? "N/A")}</span>
          </div>

          {latestArtifact ? (
            <div style={{ background: "rgba(0, 0, 0, 0.28)", border: "1px solid var(--border)", padding: 14, borderRadius: 4 }}>
              <div className="data-row" style={{ marginBottom: 8 }}>
                <span className="data-label">OUTPUT TYPE:</span>
                <span className="badge badge-done">{latestArtifact.artifactType}</span>
              </div>
              <div className="data-label" style={{ marginBottom: 4 }}>RESULT</div>
              <div className="data-value" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {latestArtifact.pathOrUrl}
              </div>
            </div>
          ) : (
            <p className="data-label">No artifact was produced for this mission.</p>
          )}

          {eventSummary && (
            <div style={{ marginTop: 14 }}>
              <div className="data-label" style={{ marginBottom: 4 }}>SUMMARY</div>
              <div className="data-value">{eventSummary}</div>
            </div>
          )}
        </div>
      )}

      <MissionLiveLog missionId={mission.id} />

      <div className="agent-status-banner">
        <div className="pulse"></div>
        <span><strong>SysInfo:</strong> Detailed telemetry for Node ID [{mission.id}]</span>
      </div>

      {isCompleted && (
        <h3 className="page-title" style={{ fontSize: "14px", marginTop: "0", marginBottom: "20px" }}>
          TECHNICAL DETAILS
        </h3>
      )}

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "40px" }}>
        <div className="isometric-card" style={{ height: "100%" }}>
          <h3 className="card-title" style={{ color: "var(--accent)", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>MISSION DIRECTIVE</h3>
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 20, fontStyle: "italic" }}>"{mission.description}"</p>
          
          <div className="card-details" style={{ display: "block", marginTop: 0, paddingTop: 16, borderTop: "1px dashed var(--border)" }}>
            <div className="data-row">
              <span className="data-label">PRIORITY:</span>
              <span className="data-value" style={{ color: "var(--accent)" }}>Level {mission.priority}</span>
            </div>
            <div className="data-row">
              <span className="data-label">OPERATOR:</span>
              <span className="data-value">{mission.createdBy}</span>
            </div>
            <div className="data-row">
              <span className="data-label">TIME_START:</span>
              <span className="data-value">{formatDateTimeCDMX(mission.createdAt)}</span>
            </div>
            {mission.budgetLimit && (
              <div className="data-row">
                <span className="data-label">RESTRICTION (BUDGET):</span>
                <span className="data-value" style={{ color: "var(--yellow)" }}>${mission.budgetLimit}</span>
              </div>
            )}
          </div>
        </div>

        <div className="isometric-card" style={{ height: "100%" }}>
          <h3 className="card-title" style={{ color: "var(--accent)", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
            ATTACHED ARTIFACTS [{mission.artifacts?.length ?? 0}]
          </h3>
          {mission.artifacts?.length === 0 ? (
            <p className="data-label" style={{ textAlign: "center", marginTop: "30px" }}>NO ARTIFACTS DETECTED</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mission.artifacts?.map((a: { id: string; artifactType: string; pathOrUrl: string }) => (
                <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(0,0,0,0.2)", padding: "12px", borderLeft: "2px solid var(--accent)" }}>
                  <span className={`badge badge-${a.artifactType.toLowerCase()}`} style={{ alignSelf: "flex-start", fontSize: 9 }}>{a.artifactType}</span>
                  <span className="data-value" style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{a.pathOrUrl}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h3 className="page-title" style={{ fontSize: "14px", marginTop: "60px", marginBottom: "24px" }}>
        EXECUTION NODES [{mission.tasks?.length ?? 0}]
      </h3>
      
      <div className="diagram-canvas">
        {mission.tasks?.length === 0 ? (
          <div className="empty-state">
            <p>AWAITING ORCHESTRATOR ALLOCATION...</p>
          </div>
        ) : (
          <div className="missions-flow">
            {mission.tasks?.map((t: {
              id: string;
              title: string;
              agentType: string;
              status: string;
              retries: number;
              requiresApproval: boolean;
              metadata?: unknown;
            }) => {
              const routing = getTaskRouting(t.metadata);

              return (
              <div key={t.id} className="mission-node">
                <div className="connection-line vertical"></div>
                <div className="isometric-card" style={{ borderLeft: `2px solid ${t.requiresApproval ? "var(--yellow)" : "var(--accent)"}` }}>
                  <div className="card-header" style={{ marginBottom: 8, paddingBottom: 8 }}>
                    <span className="badge badge-planning">{t.agentType} CORE</span>
                  </div>
                  
                  <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 500, color: "#fff" }}>
                    {t.title}
                  </div>
                  
                  <div className="data-row">
                    <span className="data-label">STATE:</span>
                    <StatusBadge status={t.status} />
                  </div>

                  {routing && (
                    <div style={{ marginTop: 10, padding: "10px 12px", border: "1px dashed var(--border)", background: "rgba(0, 240, 255, 0.04)" }}>
                      <div className="data-label" style={{ marginBottom: 6 }}>EXECUTION ROUTING</div>
                      {routing.originalAgentType && (
                        <div className="data-row">
                          <span className="data-label">REQUESTED:</span>
                          <span className="data-value">{routing.originalAgentType}</span>
                        </div>
                      )}
                      {routing.executionAgentType && (
                        <div className="data-row" style={{ marginBottom: 0 }}>
                          <span className="data-label">EXECUTED BY:</span>
                          <span className="data-value">{routing.executionAgentType}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="card-details" style={{ display: "block", marginTop: 12, paddingTop: 12 }}>
                    <div className="data-row">
                      <span className="data-label">ERRORS:</span>
                      <span className="data-value" style={{ color: t.retries > 0 ? "var(--red)" : "inherit"}}>{t.retries} count</span>
                    </div>
                    {t.requiresApproval && (
                      <div className="data-row">
                        <span className="data-label">BLOCKER:</span>
                        <span className="badge badge-waiting_approval" style={{ animation: "pulsey 2s infinite" }}>HUMAN APPROVAL REQ</span>
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <Link href={`/missions/${id}/tasks/${t.id}`} className="btn" style={{ width: "100%", justifyContent: "center" }}>
                        ACCESS LOGS / RUNS
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>

      <h3 className="page-title" style={{ fontSize: "14px", marginTop: "60px", marginBottom: "24px" }}>
        SYSTEM EVENT STREAM [{events.length}]
      </h3>
      
      <div className="isometric-card" style={{ padding: 0, overflow: "hidden" }}>
        {events.length === 0 ? (
          <p className="data-label" style={{ textAlign: "center", padding: "40px" }}>NO TELEMETRY AVAILABLE</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events.map((e: { id: string; eventType: string; createdAt: string; payload: unknown }, i: number) => (
              <div key={e.id} style={{ display: "flex", padding: "16px 20px", borderBottom: i === events.length - 1 ? "none" : "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "rgba(0,0,0,0.2)" : "transparent" }}>
                <div style={{ minWidth: 100, fontSize: 11, color: "var(--text2)", fontFamily: "monospace" }}>
                  {formatTimeCDMX(e.createdAt)}
                </div>
                <div style={{ minWidth: 180, fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: 1 }}>
                  {e.eventType}
                </div>
                <div style={{ flex: 1, fontSize: 11, color: "var(--text2)", fontFamily: "monospace", overflowX: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {JSON.stringify(e.payload)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
