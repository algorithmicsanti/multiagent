import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "@wm/db";
import { AgentType, QUEUE_NAMES } from "@wm/agent-core";
import type { AgentJobPayload } from "@wm/agent-core";
import { createChildLogger } from "@wm/observability";
import { processResearchJob } from "./research-worker.js";

const log = createChildLogger({ service: "worker-research" });
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker<AgentJobPayload>(
  QUEUE_NAMES[AgentType.RESEARCH],
  async (job) => {
    log.info({ jobId: job.id, taskId: job.data.taskId }, "Job received");
    return processResearchJob(job.data);
  },
  {
    connection: redis as never,
    concurrency: CONCURRENCY,
  }
);

worker.on("completed", (job) => {
  log.info({ jobId: job.id }, "Job completed");
});

worker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Job failed");
});

const shutdown = async () => {
  log.info("Shutting down worker-research...");
  await worker.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

log.info({ concurrency: CONCURRENCY, queue: QUEUE_NAMES[AgentType.RESEARCH] }, "Worker-research started");
