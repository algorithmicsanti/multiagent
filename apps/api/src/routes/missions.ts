import type { FastifyInstance } from "fastify";
import { Prisma, prisma, syncDefaultActors } from "@wm/db";
import { logEvent, EVENT_TYPES } from "@wm/observability";
import { z } from "zod";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const CreateMissionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(5),
  budgetLimit: z.number().positive().optional(),
  createdBy: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const ListMissionsQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function isHttpLike(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function toJson(value: unknown) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

async function readArtifactText(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl || isHttpLike(pathOrUrl)) return null;

  const candidates: string[] = [];

  if (path.isAbsolute(pathOrUrl)) {
    candidates.push(pathOrUrl);
  } else {
    candidates.push(
      path.join("/app", "artifacts", pathOrUrl),
      path.join("/app", pathOrUrl),
      path.join("/artifacts", pathOrUrl)
    );
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return await readFile(candidate, "utf8");
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function missionsRoutes(server: FastifyInstance) {
  // POST /missions
  server.post("/missions", async (req, reply) => {
    await syncDefaultActors(prisma);

    const body = CreateMissionSchema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    const mission = await prisma.mission.create({
      data: {
        title: body.data.title,
        description: body.data.description,
        priority: body.data.priority,
        createdBy: body.data.createdBy,
        budgetLimit: body.data.budgetLimit ?? null,
        metadata: toJson(body.data.metadata ?? Prisma.JsonNull),
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.MISSION_CREATED,
      missionId: mission.id,
      payload: { missionId: mission.id, title: mission.title, createdBy: mission.createdBy },
    });

    return reply.status(201).send(mission);
  });

  // GET /missions
  server.get("/missions", async (req, reply) => {
    const query = ListMissionsQuerySchema.safeParse(req.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Validation error", details: query.error.flatten() });
    }

    const { status, page, limit } = query.data;
    const skip = (page - 1) * limit;

    const where = status ? { status: status as never } : {};

    const [missions, total] = await Promise.all([
      prisma.mission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { tasks: true } } },
      }),
      prisma.mission.count({ where }),
    ]);

    return reply.send({
      data: missions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // DELETE /missions (reset all missions and dependent data)
  server.delete("/missions", async (_req, reply) => {
    const [runs, artifacts, approvals, events, tasks, missions] = await prisma.$transaction([
      prisma.taskRun.deleteMany({}),
      prisma.artifact.deleteMany({}),
      prisma.approval.deleteMany({}),
      prisma.eventLog.deleteMany({}),
      prisma.task.deleteMany({}),
      prisma.mission.deleteMany({}),
    ]);

    return reply.send({
      ok: true,
      deleted: {
        missions: missions.count,
        tasks: tasks.count,
        taskRuns: runs.count,
        artifacts: artifacts.count,
        approvals: approvals.count,
        events: events.count,
      },
    });
  });

  // GET /missions/:id
  server.get<{ Params: { id: string } }>("/missions/:id", async (req, reply) => {
    const mission = await prisma.mission.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: {
          orderBy: { createdAt: "asc" },
          include: {
            requestedActor: true,
            resolvedActor: true,
          },
        },
        artifacts: { orderBy: { createdAt: "desc" } },
        approvals: { where: { status: "PENDING" } },
        _count: { select: { eventLogs: true } },
      },
    });

    if (!mission) return reply.status(404).send({ error: "Mission not found" });
    return reply.send(mission);
  });

  // PATCH /missions/:id/status
  server.patch<{ Params: { id: string }; Body: { status: string } }>(
    "/missions/:id/status",
    async (req, reply) => {
      const { id } = req.params;
      const schema = z.object({ status: z.string() });
      const body = schema.safeParse(req.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Validation error" });
      }

      const mission = await prisma.mission.update({
        where: { id },
        data: { status: body.data.status as never },
      });

      return reply.send(mission);
    }
  );

  // DELETE /missions/:id
  server.delete<{ Params: { id: string } }>("/missions/:id", async (req, reply) => {
    const { id } = req.params;
    await prisma.mission.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.MISSION_CANCELLED,
      missionId: id,
      payload: { missionId: id },
    });

    return reply.status(204).send();
  });

  // GET /missions/:id/tasks
  server.get<{ Params: { id: string } }>("/missions/:id/tasks", async (req, reply) => {
    const tasks = await prisma.task.findMany({
      where: { missionId: req.params.id },
      orderBy: { createdAt: "asc" },
      include: {
        requestedActor: true,
        resolvedActor: true,
        _count: { select: { runs: true } },
      },
    });
    return reply.send(tasks);
  });

  // GET /missions/:id/events
  server.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>(
    "/missions/:id/events",
    async (req, reply) => {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);
      const skip = (page - 1) * limit;

      const events = await prisma.eventLog.findMany({
        where: { missionId: req.params.id },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      });

      return reply.send(events);
    }
  );

  // GET /missions/:id/artifacts
  server.get<{ Params: { id: string } }>("/missions/:id/artifacts", async (req, reply) => {
    const artifacts = await prisma.artifact.findMany({
      where: { missionId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(artifacts);
  });

  // GET /missions/:id/artifacts/:artifactId/content
  server.get<{ Params: { id: string; artifactId: string } }>(
    "/missions/:id/artifacts/:artifactId/content",
    async (req, reply) => {
      const artifact = await prisma.artifact.findFirst({
        where: { id: req.params.artifactId, missionId: req.params.id },
      });

      if (!artifact) {
        return reply.status(404).send({ error: "Artifact not found" });
      }

      const fileText = await readArtifactText(artifact.pathOrUrl);
      if (fileText !== null) {
        return reply.send({
          artifactId: artifact.id,
          missionId: artifact.missionId,
          source: "file",
          pathOrUrl: artifact.pathOrUrl,
          content: fileText,
        });
      }

      const latestRun = artifact.taskId
        ? await prisma.taskRun.findFirst({
            where: { taskId: artifact.taskId },
            orderBy: { startedAt: "desc" },
            select: { outputPayload: true },
          })
        : null;

      if (latestRun?.outputPayload) {
        return reply.send({
          artifactId: artifact.id,
          missionId: artifact.missionId,
          source: "taskRun",
          pathOrUrl: artifact.pathOrUrl,
          content: latestRun.outputPayload,
        });
      }

      return reply.send({
        artifactId: artifact.id,
        missionId: artifact.missionId,
        source: "none",
        pathOrUrl: artifact.pathOrUrl,
        content: null,
      });
    }
  );

  // POST /missions/:id/artifacts
  server.post<{ Params: { id: string } }>("/missions/:id/artifacts", async (req, reply) => {
    const schema = z.object({
      artifactType: z.string(),
      pathOrUrl: z.string().min(1),
      taskId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    const artifact = await prisma.artifact.create({
      data: {
        missionId: req.params.id,
        taskId: body.data.taskId ?? null,
        artifactType: body.data.artifactType as never,
        pathOrUrl: body.data.pathOrUrl,
        metadata: toJson(body.data.metadata ?? Prisma.JsonNull),
      },
    });

    const eventPayload = {
      eventType: EVENT_TYPES.ARTIFACT_CREATED,
      missionId: req.params.id,
      payload: { artifactId: artifact.id, artifactType: artifact.artifactType },
    } as {
      eventType: string;
      missionId: string;
      taskId?: string;
      payload: Prisma.InputJsonValue;
    };

    if (body.data.taskId) {
      eventPayload.taskId = body.data.taskId;
    }

    await logEvent(prisma, eventPayload);

    return reply.status(201).send(artifact);
  });
}
