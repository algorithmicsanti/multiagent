import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AgentType,
  ArtifactType,
  CENTRAL_ORCHESTRATOR_ID,
  TaskAssignmentMode,
  TaskStatus,
} from "@wm/agent-core";
import { Prisma, prisma, syncDefaultActors } from "@wm/db";
import { logEvent, EVENT_TYPES } from "@wm/observability";

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  instructions: z.string().min(1),
  agentType: z.nativeEnum(AgentType),
  assignmentMode: z.nativeEnum(TaskAssignmentMode).default(TaskAssignmentMode.DIRECT),
  requestedActorId: z.string().min(1).optional(),
  requiresApproval: z.boolean().optional().default(false),
  timeoutSeconds: z.number().int().min(30).max(7200).optional().default(300),
  dependsOn: z.array(z.string().min(1)).optional().default([]),
  metadata: z.record(z.unknown()).optional(),
});

const ManualTaskResultSchema = z.object({
  summary: z.string().min(1).max(500),
  result: z.string().min(1),
  notes: z.string().optional(),
});

function toJson(value: unknown) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

function createActorSnapshot(actor: {
  id: string;
  key: string;
  displayName: string;
  kind: string;
  role: string;
  context: string;
  supportedAgentTypes: string[];
  runtimeAgentType: string | null;
} | null) {
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

function actorSupportsAgentType(
  actor: { supportedAgentTypes: string[] },
  agentType: string
): boolean {
  return actor.supportedAgentTypes.includes(agentType);
}

export async function tasksRoutes(server: FastifyInstance) {
  server.get<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        requestedActor: true,
        resolvedActor: true,
        mission: {
          select: { id: true, title: true, status: true },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!task) return reply.status(404).send({ error: "Task not found" });
    return reply.send(task);
  });

  server.get<{ Params: { id: string } }>("/tasks/:id/runs", async (req, reply) => {
    const runs = await prisma.taskRun.findMany({
      where: { taskId: req.params.id },
      orderBy: { startedAt: "desc" },
    });
    return reply.send(runs);
  });

  server.post<{ Params: { id: string } }>("/missions/:id/tasks", async (req, reply) => {
    await syncDefaultActors(prisma);

    const body = CreateTaskSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    const mission = await prisma.mission.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!mission) {
      return reply.status(404).send({ error: "Mission not found" });
    }

    const invalidDependency = body.data.dependsOn.length
      ? await prisma.task.findFirst({
          where: {
            id: { in: body.data.dependsOn },
            missionId: { not: req.params.id },
          },
          select: { id: true },
        })
      : null;

    if (invalidDependency) {
      return reply.status(400).send({ error: "All dependencies must belong to the same mission" });
    }

    const requestedActorId =
      body.data.assignmentMode === TaskAssignmentMode.ORCHESTRATOR
        ? CENTRAL_ORCHESTRATOR_ID
        : body.data.requestedActorId;

    const requestedActor = requestedActorId
      ? await prisma.actor.findUnique({ where: { id: requestedActorId } })
      : null;

    if (body.data.assignmentMode === TaskAssignmentMode.DIRECT) {
      if (!requestedActor) {
        return reply.status(400).send({ error: "A direct task requires an assignee" });
      }
      if (!requestedActor.active || !requestedActor.canBeAssignedDirectly) {
        return reply.status(400).send({ error: "Selected actor cannot receive direct assignments" });
      }
      if (requestedActor.id === CENTRAL_ORCHESTRATOR_ID) {
        return reply.status(400).send({ error: "Use ORCHESTRATOR mode to delegate through the central orchestrator" });
      }
      if (!actorSupportsAgentType(requestedActor, body.data.agentType)) {
        return reply.status(400).send({ error: "Selected actor does not support this task type" });
      }
    } else if (!requestedActor || requestedActor.id !== CENTRAL_ORCHESTRATOR_ID) {
      return reply.status(400).send({ error: "Orchestrator delegation must target the Central Orchestrator" });
    }

    const resolvedActor =
      body.data.assignmentMode === TaskAssignmentMode.DIRECT ? requestedActor : null;

    const task = await prisma.task.create({
      data: {
        missionId: req.params.id,
        title: body.data.title,
        instructions: body.data.instructions,
        agentType: body.data.agentType,
        assignmentMode: body.data.assignmentMode,
        requestedActorId: requestedActor?.id ?? null,
        resolvedActorId: resolvedActor?.id ?? null,
        assignmentReason:
          body.data.assignmentMode === TaskAssignmentMode.DIRECT
            ? `Direct assignment to ${resolvedActor?.displayName ?? "selected actor"}`
            : "Awaiting delegation from the central orchestrator",
        actorSnapshot: resolvedActor
          ? toJson(createActorSnapshot(resolvedActor))
          : requestedActor
            ? toJson(createActorSnapshot(requestedActor))
            : Prisma.JsonNull,
        status: TaskStatus.PENDING,
        requiresApproval: body.data.requiresApproval,
        timeoutSeconds: body.data.timeoutSeconds,
        dependsOn: body.data.dependsOn,
        metadata: toJson(body.data.metadata ?? Prisma.JsonNull),
      },
      include: {
        requestedActor: true,
        resolvedActor: true,
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_CREATED,
      missionId: req.params.id,
      taskId: task.id,
      payload: {
        taskId: task.id,
        title: task.title,
        agentType: task.agentType,
        assignmentMode: task.assignmentMode,
        requestedActorId: task.requestedActorId,
        resolvedActorId: task.resolvedActorId,
      },
    });

    return reply.status(201).send(task);
  });

  server.post<{ Params: { id: string } }>("/tasks/:id/manual-result", async (req, reply) => {
    const body = ManualTaskResultSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        resolvedActor: true,
        mission: {
          select: { id: true },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!task) return reply.status(404).send({ error: "Task not found" });
    if (!task.resolvedActor || task.resolvedActor.kind !== "HUMAN") {
      return reply.status(400).send({ error: "Manual completion is only available for human-assigned tasks" });
    }
    if (![TaskStatus.WAITING_RESULT, TaskStatus.RUNNING].includes(task.status as TaskStatus)) {
      return reply.status(400).send({ error: "Task is not waiting for a manual result" });
    }

    const completedBy = createActorSnapshot(task.resolvedActor);
    const outputPayload = {
      summary: body.data.summary,
      humanSummary: body.data.result,
      notes: body.data.notes ?? null,
      completedBy,
      submittedAt: new Date().toISOString(),
    };

    const runId = task.runs[0]?.id ?? randomUUID();

    if (task.runs[0]) {
      await prisma.taskRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          workerName: task.runs[0].workerName || `human-${task.resolvedActor.key}`,
          outputPayload: toJson(outputPayload),
          finishedAt: new Date(),
        },
      });
    } else {
      await prisma.taskRun.create({
        data: {
          id: runId,
          taskId: task.id,
          workerName: `human-${task.resolvedActor.key}`,
          inputPayload: toJson({
            taskId: task.id,
            missionId: task.mission.id,
            manual: true,
          }),
          outputPayload: toJson(outputPayload),
          startedAt: new Date(),
          finishedAt: new Date(),
          status: "completed",
        },
      });
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.COMPLETED,
        actorSnapshot: toJson(completedBy),
        assignmentReason: `Completed manually by ${task.resolvedActor.displayName}`,
      },
    });

    const artifact = await prisma.artifact.create({
      data: {
        missionId: task.mission.id,
        taskId: task.id,
        artifactType: ArtifactType.DOCUMENT,
        pathOrUrl: `manual/${task.id}.md`,
        metadata: toJson({
          summary: body.data.summary,
          submittedBy: task.resolvedActor.displayName,
          mode: "manual",
        }),
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.ARTIFACT_CREATED,
      missionId: task.mission.id,
      taskId: task.id,
      payload: { artifactId: artifact.id, artifactType: ArtifactType.DOCUMENT },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_MANUAL_COMPLETED,
      missionId: task.mission.id,
      taskId: task.id,
      payload: {
        taskId: task.id,
        actorId: task.resolvedActor.id,
        actorName: task.resolvedActor.displayName,
        summary: body.data.summary,
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_COMPLETED,
      missionId: task.mission.id,
      taskId: task.id,
      payload: {
        taskId: task.id,
        actorId: task.resolvedActor.id,
        actorName: task.resolvedActor.displayName,
        summary: body.data.summary,
        runId,
      },
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        requestedActor: true,
        resolvedActor: true,
        runs: {
          orderBy: { startedAt: "desc" },
        },
      },
    });

    return reply.send(updatedTask);
  });
}
