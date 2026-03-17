import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";
import fs from "fs/promises";
import path from "node:path";

function isHttpLike(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function artifactsRoutes(server: FastifyInstance) {
  server.get<{ Params: { id: string } }>("/artifacts/:id/content", async (req, reply) => {
    const artifact = await prisma.artifact.findUnique({
      where: { id: req.params.id },
    });

    if (!artifact) {
      return reply.status(404).send({ error: "Artifact not found" });
    }

    if (!isHttpLike(artifact.pathOrUrl)) {
      const candidates = path.isAbsolute(artifact.pathOrUrl)
        ? [artifact.pathOrUrl]
        : [
            artifact.pathOrUrl,
            path.join("/app", artifact.pathOrUrl),
            path.join("/app", "artifacts", artifact.pathOrUrl),
            path.join("/artifacts", artifact.pathOrUrl),
          ];

      for (const candidate of candidates) {
        try {
          const content = await fs.readFile(candidate, "utf-8");
          return reply.send({ content, source: "file", path: candidate });
        } catch {
          // try next path
        }
      }
    }

    const latestRun = artifact.taskId
      ? await prisma.taskRun.findFirst({
          where: { taskId: artifact.taskId },
          orderBy: { startedAt: "desc" },
          select: { outputPayload: true },
        })
      : null;

    if (latestRun?.outputPayload) {
      if (typeof latestRun.outputPayload === "object" && latestRun.outputPayload !== null) {
        const payload = latestRun.outputPayload as Record<string, unknown>;
        const markdown = payload.markdown;
        if (typeof markdown === "string" && markdown.trim().length > 0) {
          return reply.send({ content: markdown, source: "taskRun.markdown", path: artifact.pathOrUrl });
        }
      }

      const content = typeof latestRun.outputPayload === "string"
        ? latestRun.outputPayload
        : JSON.stringify(latestRun.outputPayload, null, 2);
      return reply.send({ content, source: "taskRun", path: artifact.pathOrUrl });
    }

    return reply.status(404).send({ error: "Artifact content not available" });
  });
}
