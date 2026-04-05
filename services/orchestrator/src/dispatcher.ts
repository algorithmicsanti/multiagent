import { randomUUID } from "crypto";
import { Queue } from "bullmq";
import { Prisma, prisma } from "@wm/db";
import {
  AgentType,
  BULLMQ_DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
  TaskAssignmentMode,
  TaskStatus,
  getDefaultActorForAgentType,
} from "@wm/agent-core";
import type { AgentJobPayload } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";
import type { Redis } from "ioredis";
import { notifyApprovalRequired } from "./telegram.js";
import { selectBestActorForTask } from "./actor-selection.js";

const log = createChildLogger({ service: "orchestrator", module: "dispatcher" });

type ActorRecord = {
  id: string;
  key: string;
  displayName: string;
  kind: string;
  role: string;
  context: string;
  supportedAgentTypes: string[];
  runtimeAgentType: string | null;
  canReceiveDelegation: boolean;
  priority: number;
};

type TaskRecord = {
  id: string;
  missionId: string;
  title: string;
  instructions: string;
  retries: number;
  requiresApproval: boolean;
  dependsOn: string[];
  agentType: string;
  assignmentMode: string;
  requestedActorId: string | null;
  resolvedActorId: string | null;
  assignmentReason: string | null;
  metadata: Prisma.JsonValue;
  requestedActor: ActorRecord | null;
  resolvedActor: ActorRecord | null;
};

function toJson(value: unknown) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

function createActorSnapshot(actor: ActorRecord | null) {
  if (!actor) return Prisma.JsonNull;

  return {
    id: actor.id,
    key: actor.key,
    displayName: actor.displayName,
    kind: actor.kind,
    role: actor.role,
    context: actor.context,
    supportedAgentTypes: actor.supportedAgentTypes,
    runtimeAgentType: actor.runtimeAgentType,
  };
}

function resolveExecutionAgentType(
  task: Pick<TaskRecord, "agentType" | "metadata" | "resolvedActor">,
  queues: Record<string, Queue>
): AgentType {
  const runtimeAgentType = task.resolvedActor?.runtimeAgentType;
  if (runtimeAgentType && runtimeAgentType in QUEUE_NAMES) {
    const queueName = QUEUE_NAMES[runtimeAgentType as AgentType];
    if (queues[queueName]) {
      return runtimeAgentType as AgentType;
    }
  }

  const metadata =
    task.metadata && typeof task.metadata === "object"
      ? (task.metadata as Record<string, unknown>)
      : null;

  const metadataExecutionType = metadata?.executionAgentType;
  if (typeof metadataExecutionType === "string" && metadataExecutionType in QUEUE_NAMES) {
    return metadataExecutionType as AgentType;
  }

  const directAgentType = task.agentType as AgentType;
  const directQueue = queues[QUEUE_NAMES[directAgentType]];
  if (directQueue) {
    return directAgentType;
  }

  return AgentType.PROMPTOPS;
}

export function createQueues(redis: Redis): Record<string, Queue> {
  const queues: Record<string, Queue> = {};
  for (const agentType of Object.values(AgentType)) {
    const queueName = QUEUE_NAMES[agentType];
    if (queueName && agentType !== AgentType.ORCHESTRATOR) {
      queues[queueName] = new Queue(queueName, { connection: redis as never });
    }
  }
  return queues;
}

async function ensureResolvedActor(
  task: TaskRecord,
  mission: { title: string; description: string }
): Promise<TaskRecord> {
  if (task.resolvedActor) return task;

  if (task.assignmentMode === TaskAssignmentMode.DIRECT) {
    const fallbackActor =
      task.requestedActor ??
      (await prisma.actor.findUnique({
        where: { id: getDefaultActorForAgentType(task.agentType as AgentType)?.id ?? "" },
      }));

    if (!fallbackActor) {
      throw new Error(`No direct actor found for task ${task.id}`);
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        resolvedActorId: fallbackActor.id,
        assignmentReason: task.assignmentReason ?? `Direct assignment to ${fallbackActor.displayName}`,
        actorSnapshot: toJson(createActorSnapshot(fallbackActor as unknown as ActorRecord)),
      },
      include: {
        requestedActor: true,
        resolvedActor: true,
      },
    });

    return updatedTask as unknown as TaskRecord;
  }

  const candidates = await prisma.actor.findMany({
    where: {
      active: true,
      canReceiveDelegation: true,
    },
    orderBy: [{ priority: "desc" }, { displayName: "asc" }],
  });

  const filteredCandidates = candidates.filter((candidate) => candidate.id !== task.requestedActorId);
  const selection = await selectBestActorForTask({
    missionTitle: mission.title,
    missionDescription: mission.description,
    taskTitle: task.title,
    taskInstructions: task.instructions,
    taskAgentType: task.agentType,
    candidates: filteredCandidates.map((candidate) => ({
      id: candidate.id,
      displayName: candidate.displayName,
      kind: candidate.kind,
      role: candidate.role,
      context: candidate.context,
      supportedAgentTypes: candidate.supportedAgentTypes,
      runtimeAgentType: candidate.runtimeAgentType,
      priority: candidate.priority,
    })),
  });

  const selectedActor = filteredCandidates.find((candidate) => candidate.id === selection.actorId);
  if (!selectedActor) {
    throw new Error(`Delegation selected unknown actor ${selection.actorId}`);
  }

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      resolvedActorId: selectedActor.id,
      assignmentReason: selection.reason,
      actorSnapshot: toJson(createActorSnapshot(selectedActor as unknown as ActorRecord)),
    },
    include: {
      requestedActor: true,
      resolvedActor: true,
    },
  });

  await logEvent(prisma, {
    eventType: EVENT_TYPES.TASK_DELEGATED,
    missionId: task.missionId,
    taskId: task.id,
    payload: {
      taskId: task.id,
      requestedActorId: task.requestedActorId,
      resolvedActorId: selectedActor.id,
      resolvedActorName: selectedActor.displayName,
      reason: selection.reason,
    },
  });

  return updatedTask as unknown as TaskRecord;
}

async function assignHumanTask(args: {
  task: TaskRecord;
  mission: { id: string; title: string; description: string };
  artifacts: Array<{ id: string; artifactType: string; pathOrUrl: string; metadata: Prisma.JsonValue }>;
  completedTasks: Array<{
    id: string;
    title: string;
    agentType: string;
    runs: Array<{ outputPayload: Prisma.JsonValue }>;
  }>;
}): Promise<void> {
  const actor = args.task.resolvedActor;
  if (!actor) {
    throw new Error(`Task ${args.task.id} has no resolved actor`);
  }

  const inputPayload = {
    taskId: args.task.id,
    missionId: args.mission.id,
    title: args.task.title,
    instructions: args.task.instructions,
    taskAgentType: args.task.agentType,
    assignmentMode: args.task.assignmentMode,
    requestedActor: createActorSnapshot(args.task.requestedActor),
    assignedActor: createActorSnapshot(actor),
    missionContext: {
      missionTitle: args.mission.title,
      missionDescription: args.mission.description,
      previousArtifacts: args.artifacts.map((artifact) => ({
        id: artifact.id,
        artifactType: artifact.artifactType,
        pathOrUrl: artifact.pathOrUrl,
        metadata: artifact.metadata,
      })),
      completedTaskSummaries: args.completedTasks.map((completedTask) => ({
        taskId: completedTask.id,
        title: completedTask.title,
        agentType: completedTask.agentType,
        summary:
          ((completedTask.runs[0]?.outputPayload as { summary?: string } | null)?.summary as string | undefined) ??
          "",
      })),
    },
  };

  const runId = randomUUID();

  await prisma.taskRun.create({
    data: {
      id: runId,
      taskId: args.task.id,
      workerName: `human-${actor.key}`,
      inputPayload: toJson(inputPayload),
      status: "waiting_result",
    },
  });

  await prisma.task.update({
    where: { id: args.task.id },
    data: {
      status: TaskStatus.WAITING_RESULT,
      actorSnapshot: toJson(createActorSnapshot(actor)),
    },
  });

  await prisma.mission.update({
    where: { id: args.mission.id },
    data: { status: "WAITING_RESULT" },
  });

  await logEvent(prisma, {
    eventType: EVENT_TYPES.TASK_ASSIGNED,
    missionId: args.mission.id,
    taskId: args.task.id,
    payload: {
      taskId: args.task.id,
      actorId: actor.id,
      actorName: actor.displayName,
      actorKind: actor.kind,
      assignmentMode: args.task.assignmentMode,
      runId,
    },
  });
}

export async function dispatchReadyTasks(
  missionId: string,
  queues: Record<string, Queue>
): Promise<number> {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, title: true, description: true },
  });
  if (!mission) return 0;

  const pendingTasks = await prisma.task.findMany({
    where: { missionId, status: TaskStatus.PENDING },
    orderBy: { createdAt: "asc" },
    include: {
      requestedActor: true,
      resolvedActor: true,
    },
  });

  const completedTaskIds = new Set(
    (
      await prisma.task.findMany({
        where: { missionId, status: TaskStatus.COMPLETED },
        select: { id: true },
      })
    ).map((task) => task.id)
  );

  let dispatched = 0;

  for (const pendingTask of pendingTasks) {
    const depsOk = pendingTask.dependsOn.every((depId: string) => completedTaskIds.has(depId));
    if (!depsOk) continue;

    if (pendingTask.requiresApproval) {
      await prisma.task.update({
        where: { id: pendingTask.id },
        data: { status: TaskStatus.WAITING_APPROVAL },
      });

      await prisma.approval.create({
        data: {
          missionId,
          taskId: pendingTask.id,
          actionType: "task.execute",
          requestedBy: "orchestrator",
          notes: `Approval required before executing task ${pendingTask.title}`,
        },
      });

      await logEvent(prisma, {
        eventType: EVENT_TYPES.APPROVAL_REQUESTED,
        missionId,
        taskId: pendingTask.id,
        payload: { taskId: pendingTask.id, title: pendingTask.title, agentType: pendingTask.agentType },
      });

      await notifyApprovalRequired({
        missionId,
        taskId: pendingTask.id,
        taskTitle: pendingTask.title,
        agentType: pendingTask.agentType,
      });
      continue;
    }

    const task = await ensureResolvedActor(pendingTask as unknown as TaskRecord, mission);
    const artifacts = await prisma.artifact.findMany({
      where: { missionId },
      orderBy: { createdAt: "asc" },
    });

    const completedTasks = await prisma.task.findMany({
      where: { missionId, status: TaskStatus.COMPLETED },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
    });

    if (task.resolvedActor?.kind === "HUMAN") {
      await assignHumanTask({
        task,
        mission,
        artifacts,
        completedTasks,
      });
      log.info({ taskId: task.id, actorId: task.resolvedActor.id }, "Task assigned to human actor");
      dispatched++;
      continue;
    }

    const runId = randomUUID();
    const executionAgentType = resolveExecutionAgentType(task, queues);

    const payload: AgentJobPayload = {
      jobId: randomUUID(),
      taskId: task.id,
      missionId,
      agentType: executionAgentType,
      taskAgentType: task.agentType as AgentType,
      runId,
      instructions: task.instructions,
      context: {
        missionTitle: mission.title,
        missionDescription: mission.description,
        previousArtifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          artifactType: artifact.artifactType,
          pathOrUrl: artifact.pathOrUrl,
          metadata: artifact.metadata as Record<string, unknown> | undefined,
        })),
        completedTaskSummaries: completedTasks.map((completedTask) => ({
          taskId: completedTask.id,
          title: completedTask.title,
          agentType: completedTask.agentType as AgentType,
          summary:
            ((completedTask.runs[0]?.outputPayload as { summary?: string } | null)?.summary as string | undefined) ??
            "",
        })),
        requestedActor: createActorSnapshot(task.requestedActor) as never,
        assignedActor: createActorSnapshot(task.resolvedActor) as never,
        assignmentReason: task.assignmentReason,
      },
      assignmentMode: task.assignmentMode as TaskAssignmentMode,
      retryCount: task.retries,
    };

    await prisma.taskRun.create({
      data: {
        id: runId,
        taskId: task.id,
        workerName: `worker-${executionAgentType.toLowerCase()}`,
        inputPayload: toJson(payload),
        status: "enqueued",
      },
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.ENQUEUED },
    });

    await prisma.mission.update({
      where: { id: missionId },
      data: { status: "RUNNING" },
    });

    const queueName = QUEUE_NAMES[executionAgentType];
    const queue = queues[queueName];
    if (!queue) {
      log.error({ agentType: task.agentType, executionAgentType }, "No queue found for agent type");
      continue;
    }

    await queue.add(executionAgentType, payload, BULLMQ_DEFAULT_JOB_OPTIONS);

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_ENQUEUED,
      missionId,
      taskId: task.id,
      payload: {
        taskId: task.id,
        requestedAgentType: task.agentType,
        executionAgentType,
        resolvedActorId: task.resolvedActor?.id ?? null,
        resolvedActorName: task.resolvedActor?.displayName ?? null,
        runId,
      },
    });

    log.info(
      {
        taskId: task.id,
        requestedAgentType: task.agentType,
        executionAgentType,
        resolvedActorId: task.resolvedActor?.id ?? null,
      },
      "Task enqueued"
    );
    dispatched++;
  }

  return dispatched;
}
