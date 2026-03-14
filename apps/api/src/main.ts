import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@wm/db";
import { logger } from "@wm/observability";
import { Redis } from "ioredis";
import { missionsRoutes } from "./routes/missions.js";
import { tasksRoutes } from "./routes/tasks.js";
import { eventsRoutes } from "./routes/events.js";
import { approvalsRoutes } from "./routes/approvals.js";
import { artifactsRoutes } from "./routes/artifacts.js";
import { healthRoutes } from "./routes/health.js";

const PORT = Number(process.env.API_PORT ?? 3001);
const HOST = process.env.API_HOST ?? "0.0.0.0";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const server = Fastify({
  loggerInstance: logger,
});

await server.register(cors, {
  origin: true,
});

// Register routes
await server.register(healthRoutes, { prefix: "/api/v1" });
await server.register(missionsRoutes, { prefix: "/api/v1" });
await server.register(tasksRoutes, { prefix: "/api/v1" });
await server.register(eventsRoutes, { prefix: "/api/v1" });
await server.register(approvalsRoutes, { prefix: "/api/v1" });
await server.register(artifactsRoutes, { prefix: "/api/v1" });

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down API...");
  await server.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  await server.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT }, "API server started");
} catch (err) {
  logger.error(err, "Failed to start API server");
  process.exit(1);
}
