-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('HUMAN', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TaskAssignmentMode" AS ENUM ('DIRECT', 'ORCHESTRATOR');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'WAITING_RESULT';

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" "ActorKind" NOT NULL,
    "role" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "supportedAgentTypes" "AgentType"[] NOT NULL,
    "runtimeAgentType" "AgentType",
    "canBeAssignedDirectly" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveDelegation" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "assignmentMode" "TaskAssignmentMode" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "requestedActorId" TEXT,
ADD COLUMN "resolvedActorId" TEXT,
ADD COLUMN "assignmentReason" TEXT,
ADD COLUMN "actorSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Actor_key_key" ON "Actor"("key");

-- CreateIndex
CREATE INDEX "Actor_active_kind_idx" ON "Actor"("active", "kind");

-- CreateIndex
CREATE INDEX "Actor_priority_idx" ON "Actor"("priority");

-- CreateIndex
CREATE INDEX "Task_assignmentMode_idx" ON "Task"("assignmentMode");

-- CreateIndex
CREATE INDEX "Task_requestedActorId_idx" ON "Task"("requestedActorId");

-- CreateIndex
CREATE INDEX "Task_resolvedActorId_idx" ON "Task"("resolvedActorId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_requestedActorId_fkey" FOREIGN KEY ("requestedActorId") REFERENCES "Actor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_resolvedActorId_fkey" FOREIGN KEY ("resolvedActorId") REFERENCES "Actor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
