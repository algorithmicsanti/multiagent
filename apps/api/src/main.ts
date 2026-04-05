import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma, syncDefaultActors } from "@wm/db";
import { logger } from "@wm/observability";
import { Redis } from "ioredis";
import { actorsRoutes } from "./routes/actors.js";
import { missionsRoutes } from "./routes/missions.js";
import { tasksRoutes } from "./routes/tasks.js";
import { eventsRoutes } from "./routes/events.js";
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

async function bootstrap() {
  await server.register(cors, {
    origin: true,
  });

  await server.register(healthRoutes, { prefix: "/api/v1" });
  await server.register(actorsRoutes, { prefix: "/api/v1" });
  await server.register(missionsRoutes, { prefix: "/api/v1" });
  await server.register(tasksRoutes, { prefix: "/api/v1" });
  await server.register(eventsRoutes, { prefix: "/api/v1" });
  await server.register(artifactsRoutes, { prefix: "/api/v1" });

  await syncDefaultActors(prisma);
  await server.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT, host: HOST }, "API server started");
}

const shutdown = async () => {
  logger.info("Shutting down API...");
  await server.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

bootstrap().catch(async (err) => {
  logger.error(err, "Failed to start API server");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(1);
});
