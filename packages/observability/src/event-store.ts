import type { PrismaClient } from "@wm/db";

export type EventPayload = Record<string, unknown>;

export async function logEvent(
  prisma: PrismaClient,
  opts: {
    eventType: string;
    payload: EventPayload;
    missionId?: string;
    taskId?: string;
  }
): Promise<void> {
  await prisma.eventLog.create({
    data: {
      eventType: opts.eventType,
      payload: opts.payload,
      missionId: opts.missionId ?? null,
      taskId: opts.taskId ?? null,
    },
  });
}

export const EVENT_TYPES = {
  MISSION_CREATED: "MISSION_CREATED",
  MISSION_PLANNING: "MISSION_PLANNING",
  PLAN_GENERATED: "PLAN_GENERATED",
  MISSION_DISPATCHING: "MISSION_DISPATCHING",
  MISSION_REVIEWING: "MISSION_REVIEWING",
  MISSION_DONE: "MISSION_DONE",
  MISSION_FAILED: "MISSION_FAILED",
  MISSION_CANCELLED: "MISSION_CANCELLED",
  TASK_ENQUEUED: "TASK_ENQUEUED",
  TASK_STARTED: "TASK_STARTED",
  TASK_COMPLETED: "TASK_COMPLETED",
  TASK_FAILED: "TASK_FAILED",
  ARTIFACT_CREATED: "ARTIFACT_CREATED",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVAL_RESOLVED: "APPROVAL_RESOLVED",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
