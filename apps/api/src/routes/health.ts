import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";
import { redis } from "../main.js";

export async function healthRoutes(server: FastifyInstance) {
  server.get("/health", async (_req, reply) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {}

    try {
      await redis.ping();
      redisOk = true;
    } catch {}

    const status = dbOk && redisOk ? "ok" : "degraded";
    const statusCode = status === "ok" ? 200 : 503;

    return reply.status(statusCode).send({
      status,
      db: dbOk ? "ok" : "error",
      redis: redisOk ? "ok" : "error",
      timestamp: new Date().toISOString(),
    });
  });
}
