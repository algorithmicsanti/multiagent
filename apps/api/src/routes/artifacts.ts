import type { FastifyInstance } from "fastify";
import { prisma } from "@wm/db";

export async function artifactsRoutes(_server: FastifyInstance) {
  // Artifacts are accessed via /missions/:id/artifacts in missions routes
  // This file exists for future standalone artifact endpoints
}
