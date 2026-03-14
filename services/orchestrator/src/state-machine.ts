import { prisma } from "@wm/db";
import { MissionStatus, TaskStatus } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "orchestrator", module: "state-machine" });

export async function checkMissionCompletion(missionId: string): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: { missionId },
    select: { status: true },
  });

  if (tasks.length === 0) return;

  const statuses = tasks.map((t) => t.status as TaskStatus);
  const allDone = statuses.every((s) => s === TaskStatus.COMPLETED || s === TaskStatus.CANCELLED);
  const anyFailed = statuses.some((s) => s === TaskStatus.FAILED);
  const anyRunning = statuses.some(
    (s) => s === TaskStatus.RUNNING || s === TaskStatus.ENQUEUED
  );

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { status: true },
  });

  if (!mission) return;
  const currentStatus = mission.status as MissionStatus;

  if (
    currentStatus === MissionStatus.DISPATCHING ||
    currentStatus === MissionStatus.RUNNING ||
    currentStatus === MissionStatus.WAITING_RESULT
  ) {
    if (anyFailed && !anyRunning) {
      await prisma.mission.update({
        where: { id: missionId },
        data: { status: MissionStatus.FAILED },
      });
      await logEvent(prisma, {
        eventType: EVENT_TYPES.MISSION_FAILED,
        missionId,
        payload: { missionId, reason: "One or more tasks failed" },
      });
      log.warn({ missionId }, "Mission failed");
    } else if (allDone && !anyFailed) {
      await prisma.mission.update({
        where: { id: missionId },
        data: { status: MissionStatus.REVIEWING },
      });
      await logEvent(prisma, {
        eventType: EVENT_TYPES.MISSION_REVIEWING,
        missionId,
        payload: { missionId },
      });
      log.info({ missionId }, "Mission moved to REVIEWING");
    }
  }
}
