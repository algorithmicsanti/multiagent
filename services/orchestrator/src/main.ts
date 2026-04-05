import { Redis } from "ioredis";
import { Prisma, prisma, syncDefaultActors } from "@wm/db";
import { MissionStatus, AgentType, TaskAssignmentMode, getDefaultActorForAgentType } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";
import { generateMissionPlan } from "./planner.js";
import { createQueues, dispatchReadyTasks } from "./dispatcher.js";
import { checkMissionCompletion } from "./state-machine.js";
import { notifyMissionStatus, pollTelegramUpdates } from "./telegram.js";

const log = createChildLogger({ service: "orchestrator" });
const POLL_INTERVAL_MS = Number(process.env.ORCHESTRATOR_POLL_INTERVAL_MS ?? 10_000);

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const queues = createQueues(redis);

function toJson(value: unknown) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

async function buildPriorMissionContext(title: string): Promise<string> {
  const similar = await prisma.mission.findMany({
    where: {
      status: MissionStatus.DONE,
      title: { contains: title.slice(0, 32), mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
    include: {
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      eventLogs: {
        where: { eventType: EVENT_TYPES.TASK_COMPLETED },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (similar.length === 0) return "None";

  return similar
    .map((m, i) => {
      const summaries = m.eventLogs
        .map((e) => {
          const payload = (e.payload ?? {}) as Record<string, unknown>;
          return typeof payload.summary === "string" ? payload.summary : null;
        })
        .filter((v): v is string => Boolean(v));
      const artifact = m.artifacts[0]?.pathOrUrl ?? "n/a";
      return `${i + 1}) Mission ${m.id} | ${m.title}\n- artifact: ${artifact}\n- summaries: ${summaries.join(" | ") || "n/a"}`;
    })
    .join("\n\n");
}

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
      const priorContext = await buildPriorMissionContext(mission.title);
      plan = await generateMissionPlan(mission.title, mission.description, priorContext);
    } catch (err) {
      log.error({ missionId, err }, "Planning failed");
      await prisma.mission.update({ where: { id: missionId }, data: { status: MissionStatus.FAILED } });
      await logEvent(prisma, {
        eventType: EVENT_TYPES.MISSION_FAILED,
        missionId,
        payload: { missionId, reason: "Planning failed", error: String(err) },
      });
      await notifyMissionStatus({
        missionId,
        title: mission.title,
        status: "FAILED",
        reason: "Planning failed",
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
      const defaultActor = getDefaultActorForAgentType(planned.agentType as AgentType);

      const task = await prisma.task.create({
        data: {
          missionId,
          agentType: planned.agentType as AgentType,
          assignmentMode: TaskAssignmentMode.DIRECT,
          requestedActorId: defaultActor?.id ?? null,
          resolvedActorId: defaultActor?.id ?? null,
          title: planned.title,
          instructions: planned.instructions,
          dependsOn: resolvedDeps,
          requiresApproval: planned.requiresApproval,
          timeoutSeconds: planned.timeoutSeconds,
          assignmentReason: defaultActor ? `Planner assigned default actor ${defaultActor.displayName}` : null,
          actorSnapshot: defaultActor
            ? toJson({
                id: defaultActor.id,
                key: defaultActor.key,
                displayName: defaultActor.displayName,
                kind: defaultActor.kind,
                role: defaultActor.role,
                context: defaultActor.context,
                supportedAgentTypes: defaultActor.supportedAgentTypes,
                runtimeAgentType: defaultActor.runtimeAgentType ?? null,
              })
            : Prisma.JsonNull,
          metadata: toJson(planned.metadata ?? Prisma.JsonNull),
        },
      });
      createdTaskIds.push(task.id);

      await logEvent(prisma, {
        eventType: EVENT_TYPES.TASK_CREATED,
        missionId,
        taskId: task.id,
        payload: {
          taskId: task.id,
          title: task.title,
          agentType: task.agentType,
          assignmentMode: task.assignmentMode,
          resolvedActorId: task.resolvedActorId,
        },
      });
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
    status === MissionStatus.REVIEWING ||
    mission.status === MissionStatus.DISPATCHING
  ) {
    if (status !== MissionStatus.REVIEWING) {
      const dispatched = await dispatchReadyTasks(missionId, queues);
      if (dispatched > 0) {
        log.info({ missionId, dispatched }, "Tasks dispatched");
      }
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
            MissionStatus.REVIEWING,
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
  await syncDefaultActors(prisma);
  log.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Orchestrator started");

  const loop = async () => {
    await Promise.all([tick(), pollTelegramUpdates()]);
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

run().catch(async (err) => {
  log.error({ err }, "Orchestrator fatal error");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(1);
});
