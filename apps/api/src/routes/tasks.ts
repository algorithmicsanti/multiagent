import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";

export async function tasksRoutes(server: FastifyInstance) {
  // GET /tasks/:id/runs
  server.get<{ Params: { id: string } }>("/tasks/:id/runs", async (req, reply) => {
    const runs = await prisma.taskRun.findMany({
      where: { taskId: req.params.id },
      orderBy: { startedAt: "desc" },
    });
    return reply.send(runs);
  });
}
