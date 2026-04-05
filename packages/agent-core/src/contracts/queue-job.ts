import type { ActorSnapshot } from "../actors.js";
import type { AgentType, TaskAssignmentMode } from "../enums.js";

export interface ArtifactRef {
  id: string;
  artifactType: string;
  pathOrUrl: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface TaskSummaryRef {
  taskId: string;
  title: string;
  agentType: AgentType;
  summary: string;
}

export interface MissionContext {
  missionTitle: string;
  missionDescription: string;
  previousArtifacts: ArtifactRef[];
  completedTaskSummaries: TaskSummaryRef[];
  requestedActor?: ActorSnapshot | null;
  assignedActor?: ActorSnapshot | null;
  assignmentReason?: string | null;
}

export interface AgentJobPayload {
  jobId: string;
  taskId: string;
  missionId: string;
  agentType: AgentType;
  taskAgentType: AgentType;
  runId: string;
  instructions: string;
  context: MissionContext;
  assignmentMode: TaskAssignmentMode;
  retryCount: number;
}

export const BULLMQ_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};
