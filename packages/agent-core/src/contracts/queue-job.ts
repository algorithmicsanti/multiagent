import type { AgentType } from "../enums.js";

export interface ArtifactRef {
  id: string;
  artifactType: string;
  pathOrUrl: string;
  metadata?: Record<string, unknown>;
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
}

export interface AgentJobPayload {
  jobId: string;
  taskId: string;
  missionId: string;
  agentType: AgentType;
  runId: string;
  instructions: string;
  context: MissionContext;
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
