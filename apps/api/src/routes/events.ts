import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";

export async function eventsRoutes(server: FastifyInstance) {
  // GET /events — SSE global feed
  server.get("/events", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send last 20 events on connect
    const recent = await prisma.eventLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    recent.reverse().forEach(sendEvent);

    // Poll for new events every 2s
    let lastId = recent[recent.length - 1]?.id ?? "";
    const interval = setInterval(async () => {
      try {
        const newEvents = await prisma.eventLog.findMany({
          where: lastId
            ? { createdAt: { gt: (await prisma.eventLog.findUnique({ where: { id: lastId } }))!.createdAt } }
            : {},
          orderBy: { createdAt: "asc" },
          take: 50,
        });
        newEvents.forEach((e) => {
          sendEvent(e);
          lastId = e.id;
        });
      } catch {}
    }, 2000);

    req.raw.on("close", () => {
      clearInterval(interval);
    });
  });
}
