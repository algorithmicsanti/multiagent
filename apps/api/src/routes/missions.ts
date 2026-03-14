import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";
import { logEvent, EVENT_TYPES } from "@wm/observability";
import { z } from "zod";

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

export async function missionsRoutes(server: FastifyInstance) {
  // POST /missions
  server.post("/missions", async (req, reply) => {
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
        metadata: body.data.metadata ?? null,
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

  // GET /missions/:id
  server.get<{ Params: { id: string } }>("/missions/:id", async (req, reply) => {
    const mission = await prisma.mission.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: { orderBy: { createdAt: "asc" } },
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
      include: { _count: { select: { runs: true } } },
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
        metadata: body.data.metadata ?? null,
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.ARTIFACT_CREATED,
      missionId: req.params.id,
      taskId: body.data.taskId,
      payload: { artifactId: artifact.id, artifactType: artifact.artifactType },
    });

    return reply.status(201).send(artifact);
  });
}
