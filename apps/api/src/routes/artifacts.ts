import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";
import fs from "fs/promises";

export async function artifactsRoutes(server: FastifyInstance) {
  server.get<{ Params: { id: string } }>("/artifacts/:id/content", async (req, reply) => {
    const artifact = await prisma.artifact.findUnique({
      where: { id: req.params.id },
    });

    if (!artifact) {
      return reply.status(404).send({ error: "Artifact not found" });
    }

    try {
      // In a real production scenario you might read from S3/blob, here we assume a local filesystem
      const content = await fs.readFile(artifact.pathOrUrl, "utf-8");
      return reply.send({ content });
    } catch (e) {
      server.log.error(e, `Failed to read artifact file at ${artifact.pathOrUrl}`);
      return reply.status(500).send({ error: "File not accessible" });
    }
  });
}
