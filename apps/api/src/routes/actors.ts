import type { FastifyInstance } from "fastify";
import { prisma, syncDefaultActors } from "@wm/db";

export async function actorsRoutes(server: FastifyInstance) {
  server.get("/actors", async (_req, reply) => {
    await syncDefaultActors(prisma);

    const actors = await prisma.actor.findMany({
      where: { active: true },
      orderBy: [{ priority: "desc" }, { displayName: "asc" }],
    });

    return reply.send(actors);
  });
}
