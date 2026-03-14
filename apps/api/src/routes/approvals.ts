import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";
import { logEvent, EVENT_TYPES } from "@wm/observability";
import { z } from "zod";

export async function approvalsRoutes(server: FastifyInstance) {
  // GET /approvals
  server.get("/approvals", async (_req, reply) => {
    const approvals = await prisma.approval.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { mission: { select: { title: true } } },
    });
    return reply.send(approvals);
  });

  // POST /approvals/:id/resolve
  server.post<{ Params: { id: string } }>("/approvals/:id/resolve", async (req, reply) => {
    const schema = z.object({
      action: z.enum(["approve", "reject"]),
      notes: z.string().optional(),
      resolvedBy: z.string().default("human"),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    const newStatus = body.data.action === "approve" ? "APPROVED" : "REJECTED";

    const approval = await prisma.approval.update({
      where: { id: req.params.id },
      data: {
        status: newStatus,
        approvedBy: body.data.resolvedBy,
        notes: body.data.notes ?? null,
        resolvedAt: new Date(),
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.APPROVAL_RESOLVED,
      missionId: approval.missionId,
      taskId: approval.taskId ?? undefined,
      payload: {
        approvalId: approval.id,
        action: body.data.action,
        resolvedBy: body.data.resolvedBy,
      },
    });

    return reply.send(approval);
  });
}
