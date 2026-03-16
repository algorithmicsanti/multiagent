import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTimeCDMX, formatTimeCDMX } from "../../lib/datetime";

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

async function getArtifactContent(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/artifacts/${id}/content`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string | null };
    return data.content ?? null;
  } catch {
    return null;
  }
}

function parseMarkdownToHTML(text: string) {
  // Un conversor muy simple de Markdown a HTML para evitar tags <pre> y JSONs feos
  let html = text
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Headers
    .replace(/^### (.*$)/gim, '<h4 style="margin-top: 16px; margin-bottom: 8px; color: var(--accent);">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--accent);">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 style="margin-top: 24px; margin-bottom: 12px; color: var(--accent);">$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Lists
    .replace(/^\s*\n\*/gm, '<ul>\n*')
    .replace(/^(\d+\.) (.*$)/gim, '<div style="margin-bottom: 8px; margin-left: 12px;"><strong>$1</strong> $2</div>')
    .replace(/^\* (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>')
    // Line breaks
    .replace(/\n$/gim, '<br />')
    // Code blocks
    .replace(/```([\s\S]*?)```/gim, '<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; overflow-x: auto;"><code>$1</code></pre>')
    // Inline code
    .replace(/`(.*?)`/gim, '<code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 2px;">$1</code>');

  return html;
}

function formatHumanResult(content: string | null): string {
  if (!content) return "El sistema no generó ningún resumen al finalizar la misión.";

  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    // We avoid showing Orchestrator's internal plans or nextSteps
    if (parsed.report) return String(parsed.report);
    if (parsed.markdown) return String(parsed.markdown);
    if (parsed.content) return String(parsed.content);
    if (parsed.rawResearch) return String(parsed.rawResearch);
    if (parsed.humanSummary) return String(parsed.humanSummary);
    
    // If we have structured findings from the research worker
    if (Array.isArray(parsed.findings) && parsed.findings.length > 0) {
      let md = `> ${parsed.summary || 'Investigación Completada'}\n\n### Hallazgos Principales:\n\n`;
      parsed.findings.forEach((f: any) => {
        md += `* **${f.area}:** ${f.finding}\n`;
        if (f.recommendation) md += `  *Recomendación:* ${f.recommendation}\n`;
      });
      if (Array.isArray(parsed.risks) && parsed.risks.length > 0) {
        md += `\n### Riesgos Detectados:\n` + parsed.risks.map(r => `* ${r}`).join('\n') + `\n`;
      }
      return md;
    }

    // If it's just pure json without text result
    if (parsed.summary && !parsed.rawPlan) return String(parsed.summary);
    
    // If it's a technical payload (like the orchestrator plan)
    if (parsed.rawPlan || parsed.nextSteps) {
       return "El documento contiene información de planificación técnica (ver logs). La salida principal está siendo procesada o no tiene un reporte escrito.";
    }

    // Default fallback if we can't find a text variable
    return "Resultado en formato técnico (no visualizable en reporte humano).";
  } catch {
    // Es texto puro / Markdown
    return trimmed;
  }
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

function renderEventMessage(eventType: string, payload: any) {
  if (!payload || typeof payload !== 'object') return JSON.stringify(payload);

  switch (eventType) {
    case 'MISSION_CREATED':
      return `Misión "${payload.title || 'Nueva'}" registrada en el sistema por el operador ${payload.createdBy || 'desconocido'}.`;
    case 'MISSION_PLANNING':
      return `El Orquestador Central está analizando los requisitos para trazar un plan de ejecución.`;
    case 'PLAN_GENERATED':
      return `El plan estratégico ha sido definido exitosamente con las siguientes fases metodológicas: ${payload.notes || 'Tareas definidas'}.`;
    case 'MISSION_DISPATCHING':
      return `Asignando tareas a los agentes especialistas requeridos...`;
    case 'TASK_ENQUEUED':
      return `Una nueva tarea ha sido delegada y puesta en espera. El agente de tipo ${payload.executionAgentType || payload.requestedAgentType || 'desconocido'} tomará el control pronto.`;
    case 'TASK_STARTED':
      return `El agente asignado ha comenzado a trabajar en la tarea activa.`;
    case 'TASK_COMPLETED':
      return `El agente finalizó el procesamiento de la tarea con éxito.`;
    case 'TASK_FAILED':
      return `El agente encontró un error durante la ejecución: ${payload.error || payload.reason || 'Causa desconocida'}`;
    case 'MISSION_COMPLETED':
    case 'MISSION_DONE':
      return `Todas las tareas fueron completadas. La misión ha finalizado con éxito.`;
    case 'MISSION_FAILED':
      return `La misión abortó su curso debido a un fallo crítico: ${payload.error || payload.reason || 'Desconocido'}`;
    case 'ARTIFACT_CREATED':
      return `Un agente generó un nuevo documento o artefacto de salida.`;
    default:
      if (payload.message) return payload.message;
      if (payload.notes) return payload.notes;
      if (payload.summary) return payload.summary;
      return JSON.stringify(payload);
  }
}

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [mission, events] = await Promise.all([getMission(id), getMissionEvents(id)]);

  if (!mission) notFound();

  const isCompleted = mission.status === "DONE";
  const requestedFormat = extractRequestedFormat(mission);
  const latestArtifact = mission.artifacts && mission.artifacts.length > 0
    ? mission.artifacts.slice(-1)[0]
    : null;
  const eventSummary = extractSummaryFromEvents(events as Array<{ payload: unknown }>);

  let artifactContent: string | null = null;
  if (latestArtifact) {
    artifactContent = await getArtifactContent(latestArtifact.id);
  }
  const formattedResult = formatHumanResult(artifactContent);

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
        <div style={{ marginBottom: 40 }}>
          <h3 className="page-title" style={{ fontSize: "14px", marginTop: "0", marginBottom: "16px" }}>FINAL RESULT</h3>
          
          <div className="isometric-card" style={{ padding: 24, borderTop: "3px solid var(--accent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span className="data-label">REPORT SUMMARY</span>
              <span className="badge badge-done">{latestArtifact?.artifactType ?? requestedFormat ?? "OUTPUT"}</span>
            </div>

            <div style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.6, background: "var(--bg)", padding: "24px 32px", border: "1px solid var(--border)", marginBottom: 12, borderRadius: "8px" }}>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: parseMarkdownToHTML(formattedResult || eventSummary || "Sin reporte disponible.")
                }}
                style={{ 
                  fontFamily: "var(--font-body), sans-serif",
                  whiteSpace: "pre-line" // Important for simple newlines inside the text
                }}
              />
            </div>

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px dashed var(--border)", fontSize: "11px", color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
                 <span>Source artifact: <code>{latestArtifact?.pathOrUrl ?? "Not available"}</code></span>
            </div>
          </div>
        </div>
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
                <div className="isometric-card" style={{ borderLeft: `2px solid var(--accent)` }}>
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
                <div style={{ flex: 1, fontSize: 12, color: "var(--text)", lineHeight: 1.5, textOverflow: "ellipsis", overflow: "hidden" }}>
                  {renderEventMessage(e.eventType, e.payload)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
