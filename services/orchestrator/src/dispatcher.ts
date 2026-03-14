import { Queue } from "bullmq";
import { prisma } from "@wm/db";
import {
  AgentType,
  TaskStatus,
  QUEUE_NAMES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
} from "@wm/agent-core";
import type { AgentJobPayload } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";
import type { Redis } from "ioredis";
import { randomUUID } from "crypto";

const log = createChildLogger({ service: "orchestrator", module: "dispatcher" });

export function createQueues(redis: Redis): Record<string, Queue> {
  const queues: Record<string, Queue> = {};
  for (const agentType of Object.values(AgentType)) {
    const queueName = QUEUE_NAMES[agentType];
    if (queueName && agentType !== AgentType.ORCHESTRATOR) {
      queues[queueName] = new Queue(queueName, { connection: redis });
    }
  }
  return queues;
}

export async function dispatchReadyTasks(
  missionId: string,
  queues: Record<string, Queue>
): Promise<number> {
  // Find tasks that are PENDING and have all dependencies completed
  const pendingTasks = await prisma.task.findMany({
    where: { missionId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  const completedTaskIds = new Set(
    (
      await prisma.task.findMany({
        where: { missionId, status: "COMPLETED" },
        select: { id: true },
      })
    ).map((t) => t.id)
  );

  let dispatched = 0;

  for (const task of pendingTasks) {
    const depsOk = task.dependsOn.every((depId) => completedTaskIds.has(depId));
    if (!depsOk) continue;

    const runId = randomUUID();

    // Build context
    const artifacts = await prisma.artifact.findMany({
      where: { missionId },
      orderBy: { createdAt: "asc" },
    });

    const completedTasks = await prisma.task.findMany({
      where: { missionId, status: "COMPLETED" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
    });

    const mission = await prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) continue;

    const payload: AgentJobPayload = {
      jobId: randomUUID(),
      taskId: task.id,
      missionId,
      agentType: task.agentType as AgentType,
      runId,
      instructions: task.instructions,
      context: {
        missionTitle: mission.title,
        missionDescription: mission.description,
        previousArtifacts: artifacts.map((a) => ({
          id: a.id,
          artifactType: a.artifactType,
          pathOrUrl: a.pathOrUrl,
          metadata: (a.metadata as Record<string, unknown>) ?? undefined,
        })),
        completedTaskSummaries: completedTasks.map((t) => ({
          taskId: t.id,
          title: t.title,
          agentType: t.agentType as AgentType,
          summary: (t.runs[0]?.outputPayload as { summary?: string } | null)?.summary ?? "",
        })),
      },
      retryCount: task.retries,
    };

    // Create task run record
    await prisma.taskRun.create({
      data: {
        id: runId,
        taskId: task.id,
        workerName: `worker-${task.agentType.toLowerCase()}`,
        inputPayload: payload as unknown as Record<string, unknown>,
        status: "enqueued",
      },
    });

    // Update task status
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "ENQUEUED" },
    });

    // Enqueue to BullMQ
    const queueName = QUEUE_NAMES[task.agentType as AgentType];
    const queue = queues[queueName];
    if (!queue) {
      log.error({ agentType: task.agentType }, "No queue found for agent type");
      continue;
    }

    await queue.add(task.agentType, payload, BULLMQ_DEFAULT_JOB_OPTIONS);

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_ENQUEUED,
      missionId,
      taskId: task.id,
      payload: { taskId: task.id, agentType: task.agentType, runId },
    });

    log.info({ taskId: task.id, agentType: task.agentType }, "Task enqueued");
    dispatched++;
  }

  return dispatched;
}
