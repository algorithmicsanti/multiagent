import { createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "worker-research", module: "telegram" });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramNotification(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

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

export async function notifyTaskCompleted(opts: {
  missionId: string;
  taskId: string;
  taskTitle: string;
  summary?: string;
}): Promise<void> {
  const text = [
    "✅ Tarea finalizada",
    `Misión: ${opts.missionId}`,
    `Task: ${opts.taskId}`,
    `Título: ${opts.taskTitle}`,
    opts.summary ? `Resumen: ${opts.summary}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  await sendTelegramNotification(text);
}
