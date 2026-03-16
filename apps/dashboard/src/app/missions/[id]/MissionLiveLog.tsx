"use client";

import { useEffect, useMemo, useState } from "react";

type MissionEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
};

function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }

  return "http://api:3001";
}

function humanizeEvent(event: MissionEvent | null): string {
  if (!event) return "Sin eventos todavía.";

  const payload = event.payload ?? {};

  switch (event.eventType) {
    case "MISSION_CREATED":
      return "Misión creada y en cola de planificación.";
    case "MISSION_PLANNING":
      return "El orquestador está diseñando el plan de tareas.";
    case "PLAN_GENERATED":
      return `Plan generado con ${String(payload.taskCount ?? "?")} tareas.`;
    case "MISSION_DISPATCHING":
      return "Despachando tareas a workers disponibles.";
    case "TASK_ENQUEUED":
      return `Tarea en cola: ${String(payload.taskId ?? "N/A")}.`;
    case "TASK_STARTED":
      return `Tarea en ejecución: ${String(payload.taskId ?? "N/A")}.`;
    case "TASK_COMPLETED":
      return `Tarea finalizada: ${String(payload.summary ?? "sin resumen")}.`;
    case "TASK_FAILED":
      return `Tarea falló: ${String(payload.error ?? "error desconocido")}.`;
    case "MISSION_REVIEWING":
      return "Todas las tareas terminaron. Misión en revisión.";
    case "MISSION_FAILED":
      return `Misión fallida: ${String(payload.reason ?? "sin motivo")}.`;
    default:
      return `${event.eventType} registrado.`;
  }
}

export default function MissionLiveLog({ missionId }: { missionId: string }) {
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const apiUrl = resolveApiUrl();
        const res = await fetch(`${apiUrl}/api/v1/missions/${missionId}/events?limit=100`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as MissionEvent[];
        if (!cancelled) {
          setEvents(data);
          setLoading(false);
          setError(null);
          setLastUpdatedAt(new Date().toISOString());
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : "Error al actualizar eventos");
        }
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [missionId]);

  const latest = useMemo(() => {
    if (events.length === 0) return null;
    return events[events.length - 1] ?? null;
  }, [events]);

  return (
    <div className="isometric-card" style={{ marginBottom: 20, borderLeft: "3px solid var(--accent)" }}>
      <h3 className="card-title" style={{ marginBottom: 10 }}>ÚLTIMO LOG (HUMANO)</h3>

      {loading ? (
        <p className="data-label">Cargando estado en vivo...</p>
      ) : error ? (
        <p className="data-label" style={{ color: "var(--red)" }}>No se pudo actualizar: {error}</p>
      ) : (
        <>
          <p className="data-value" style={{ marginBottom: 8 }}>{humanizeEvent(latest)}</p>
          <div className="data-row" style={{ marginBottom: 4 }}>
            <span className="data-label">EVENTO:</span>
            <span className="data-value">{latest?.eventType ?? "N/A"}</span>
          </div>
          <div className="data-row" style={{ marginBottom: 0 }}>
            <span className="data-label">ACTUALIZADO:</span>
            <span className="data-value">
              {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "N/A"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
