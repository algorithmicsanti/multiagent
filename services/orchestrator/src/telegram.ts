import { createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "orchestrator", module: "telegram" });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

export async function notifyMissionStatus(opts: {
  missionId: string;
  title?: string;
  status: string;
  reason?: string;
}): Promise<void> {
  // Requisito operativo: notificar SOLO al finalizar correctamente.
  if (opts.status !== "DONE") return;

  const titlePart = opts.title ? ` (${opts.title})` : "";
  const text = `✅ Mission DONE: ${opts.missionId}${titlePart}`;
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
