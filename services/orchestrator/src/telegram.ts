import { createChildLogger } from "@wm/observability";
import { prisma } from "@wm/db";
import fs from "node:fs/promises";
import path from "node:path";

const log = createChildLogger({ service: "orchestrator", module: "telegram" });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let lastUpdateId = 0;

export async function pollTelegramUpdates(): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
      { method: "GET" }
    );

    if (!res.ok) return;
    const body: any = await res.json();
    if (!body.ok || !body.result || body.result.length === 0) return;

    for (const update of body.result) {
      if (update.update_id > lastUpdateId) {
        lastUpdateId = update.update_id;
      }

      const msg = update.message;
      if (!msg || !msg.text) continue;
      
      // Solo aceptamos mensajes del CHAT_ID configurado (por seguridad)
      if (String(msg.chat.id) !== CHAT_ID) continue;

      const text = msg.text.trim();
      log.info({ updateId: update.update_id, text }, "Mensaje de telegram recibido");

      if (text.startsWith("/mission ") || text.startsWith("/tarea ")) {
        const description = text.replace(/^\/(mission|tarea)\s+/i, "");
        if (description) {
          // Crear mission
          const mission = await prisma.mission.create({
            data: {
              title: "Nueva mision desde Telegram",
              description: description,
              status: "NEW", // O usando MissionStatus.NEW
              priority: 50,
            },
          });
          
          await sendTelegramNotification(`Misión creada con ID: ${mission.id}`);
        }
      }
    }
  } catch (err) {
    log.warn({ err }, "Error polleando telegram updates");
  }
}

export async function sendTelegramNotification(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      log.warn({ status: res.status, body }, "Telegram notification failed");
    }
  } catch (err) {
    log.warn({ err }, "Telegram notification error");
  }
}

function humanizeRawResult(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "(sin contenido)";

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const summary =
      (typeof parsed.executiveSummary === "string" && parsed.executiveSummary) ||
      (typeof parsed.summary === "string" && parsed.summary) ||
      "Sin resumen ejecutivo";

    const recommendation =
      (typeof parsed.recommendation === "string" && parsed.recommendation) ||
      "Sin recomendación final";

    const rows = Array.isArray(parsed.topAutomations)
      ? parsed.topAutomations.slice(0, 5).map((item, idx) => {
          if (typeof item === "string") {
            return `${idx + 1}) ${item} | Impacto: - | Esfuerzo: - | Prioridad: -`;
          }
          if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;
            const name = String(row.name ?? row.automation ?? row.title ?? `Automatización ${idx + 1}`);
            const impact = String(row.impact ?? row.expectedImpact ?? "-");
            const effort = String(row.effort ?? row.complexity ?? "-");
            const priority = String(row.priority ?? row.rank ?? "-");
            return `${idx + 1}) ${name} | Impacto: ${impact} | Esfuerzo: ${effort} | Prioridad: ${priority}`;
          }
          return `${idx + 1}) ${String(item)} | Impacto: - | Esfuerzo: - | Prioridad: -`;
        })
      : [];

    return [
      "Resumen ejecutivo:",
      summary,
      "",
      "Top 5 automatizaciones:",
      ...rows,
      "",
      "Recomendación final:",
      recommendation,
    ].join("\n").slice(0, 3200);
  } catch {
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    const top = lines.slice(0, 12).join("\n");
    return top.slice(0, 3200);
  }
}

async function resolveMissionResultText(missionId: string): Promise<string | null> {
  const latestArtifact = await prisma.artifact.findFirst({
    where: { missionId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestArtifact) return null;

  const pathOrUrl = latestArtifact.pathOrUrl;
  const isHttpLike = /^https?:\/\//i.test(pathOrUrl);
  if (!isHttpLike) {
    const candidates = path.isAbsolute(pathOrUrl)
      ? [pathOrUrl]
      : [
          pathOrUrl,
          path.join("/app", pathOrUrl),
          path.join("/app", "artifacts", pathOrUrl),
          path.join("/artifacts", pathOrUrl),
        ];

    for (const candidate of candidates) {
      try {
        const text = await fs.readFile(candidate, "utf-8");
        return humanizeRawResult(text);
      } catch {
        // keep trying
      }
    }
  }

  if (latestArtifact.taskId) {
    const latestRun = await prisma.taskRun.findFirst({
      where: { taskId: latestArtifact.taskId },
      orderBy: { startedAt: "desc" },
      select: { outputPayload: true },
    });
    if (latestRun?.outputPayload) {
      const text = typeof latestRun.outputPayload === "string"
        ? latestRun.outputPayload
        : JSON.stringify(latestRun.outputPayload, null, 2);
      return humanizeRawResult(text);
    }
  }

  return null;
}

export async function notifyMissionStatus(opts: {
  missionId: string;
  title?: string;
  status: string;
  reason?: string;
}): Promise<void> {
  // Requisito operativo: notificar SOLO al finalizar correctamente.
  if (opts.status !== "DONE") return;

  const titlePart = opts.title ? ` (${opts.title})` : "";
  const result = await resolveMissionResultText(opts.missionId);
  const text = [
    `✅ Mission DONE: ${opts.missionId}${titlePart}`,
    result ? "\nResultado (humano):\n" + result : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3900);

  await sendTelegramNotification(text);
}

export async function notifyTaskCompleted(_opts: {
  missionId: string;
  taskId: string;
  taskTitle: string;
  summary?: string;
}): Promise<void> {
  // disabled by request: no intermediate Telegram notifications
}

export async function notifyApprovalRequired(_opts: {
  missionId: string;
  taskId: string;
  taskTitle: string;
  agentType: string;
}): Promise<void> {
  // disabled by request: no intermediate Telegram notifications
}
