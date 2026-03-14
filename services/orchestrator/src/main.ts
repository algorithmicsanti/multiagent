import { Redis } from "ioredis";
import { prisma } from "@wm/db";
import { MissionStatus, AgentType } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";
import { generateMissionPlan } from "./planner.js";
import { createQueues, dispatchReadyTasks } from "./dispatcher.js";
import { checkMissionCompletion } from "./state-machine.js";

const log = createChildLogger({ service: "orchestrator" });
const POLL_INTERVAL_MS = Number(process.env.ORCHESTRATOR_POLL_INTERVAL_MS ?? 10_000);

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const queues = createQueues(redis);

async function processMission(missionId: string): Promise<void> {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) return;

  const status = mission.status as MissionStatus;

  // NEW → PLANNING
  if (status === MissionStatus.NEW) {
    log.info({ missionId }, "Planning mission...");
    await prisma.mission.update({ where: { id: missionId }, data: { status: MissionStatus.PLANNING } });
    await logEvent(prisma, {
      eventType: EVENT_TYPES.MISSION_PLANNING,
      missionId,
      payload: { missionId },
    });

    let plan;
    try {
      plan = await generateMissionPlan(mission.title, mission.description);
    } catch (err) {
      log.error({ missionId, err }, "Planning failed");
      await prisma.mission.update({ where: { id: missionId }, data: { status: MissionStatus.FAILED } });
      await logEvent(prisma, {
        eventType: EVENT_TYPES.MISSION_FAILED,
        missionId,
        payload: { missionId, reason: "Planning failed", error: String(err) },
      });
      return;
    }

    // Create tasks, resolving dependsOn by index → id
    const createdTaskIds: string[] = [];
    for (let i = 0; i < plan.tasks.length; i++) {
      const planned = plan.tasks[i]!;
      const resolvedDeps = planned.dependsOn
        .map((dep) => createdTaskIds[parseInt(dep, 10)] ?? null)
        .filter((id): id is string => id !== null);

      const task = await prisma.task.create({
        data: {
          missionId,
          agentType: planned.agentType as AgentType,
          title: planned.title,
          instructions: planned.instructions,
          dependsOn: resolvedDeps,
          requiresApproval: planned.requiresApproval,
          timeoutSeconds: planned.timeoutSeconds,
          metadata: (planned.metadata as Record<string, unknown>) ?? null,
        },
      });
      createdTaskIds.push(task.id);
    }

    await logEvent(prisma, {
      eventType: EVENT_TYPES.PLAN_GENERATED,
      missionId,
      payload: { missionId, taskCount: plan.tasks.length, notes: plan.notes ?? null },
    });

    await prisma.mission.update({ where: { id: missionId }, data: { status: MissionStatus.DISPATCHING } });
    await logEvent(prisma, {
      eventType: EVENT_TYPES.MISSION_DISPATCHING,
      missionId,
      payload: { missionId },
    });

    log.info({ missionId, taskCount: createdTaskIds.length }, "Mission planned, dispatching...");
  }

  // DISPATCHING / RUNNING → dispatch ready tasks
  if (
    status === MissionStatus.DISPATCHING ||
    status === MissionStatus.RUNNING ||
    status === MissionStatus.WAITING_RESULT ||
    mission.status === MissionStatus.DISPATCHING
  ) {
    const dispatched = await dispatchReadyTasks(missionId, queues);
    if (dispatched > 0) {
      log.info({ missionId, dispatched }, "Tasks dispatched");
    }
    await checkMissionCompletion(missionId);
  }
}

async function tick(): Promise<void> {
  try {
    const activeMissions = await prisma.mission.findMany({
      where: {
        status: {
          in: [
            MissionStatus.NEW,
            MissionStatus.PLANNING,
            MissionStatus.DISPATCHING,
            MissionStatus.RUNNING,
            MissionStatus.WAITING_RESULT,
          ],
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    for (const mission of activeMissions) {
      await processMission(mission.id);
    }
  } catch (err) {
    log.error({ err }, "Orchestrator tick error");
  }
}

async function run(): Promise<void> {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Orchestrator started");

  const loop = async () => {
    await tick();
    setTimeout(loop, POLL_INTERVAL_MS);
  };

  await loop();
}

const shutdown = async () => {
  log.info("Shutting down orchestrator...");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await run();
