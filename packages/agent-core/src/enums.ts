export enum MissionStatus {
  NEW = "NEW",
  PLANNING = "PLANNING",
  DISPATCHING = "DISPATCHING",
  RUNNING = "RUNNING",
  WAITING_RESULT = "WAITING_RESULT",
  REVIEWING = "REVIEWING",
  WAITING_APPROVAL = "WAITING_APPROVAL",
  BLOCKED = "BLOCKED",
  FAILED = "FAILED",
  DONE = "DONE",
  CANCELLED = "CANCELLED",
}

export enum TaskStatus {
  PENDING = "PENDING",
  ENQUEUED = "ENQUEUED",
  RUNNING = "RUNNING",
  WAITING_RESULT = "WAITING_RESULT",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  WAITING_APPROVAL = "WAITING_APPROVAL",
  BLOCKED = "BLOCKED",
}

export enum AgentType {
  ORCHESTRATOR = "ORCHESTRATOR",
  RESEARCH = "RESEARCH",
  FRONTEND = "FRONTEND",
  BACKEND = "BACKEND",
  DEVOPS = "DEVOPS",
  PROMPTOPS = "PROMPTOPS",
}

export enum ActorKind {
  HUMAN = "HUMAN",
  AGENT = "AGENT",
  SYSTEM = "SYSTEM",
}

export enum TaskAssignmentMode {
  DIRECT = "DIRECT",
  ORCHESTRATOR = "ORCHESTRATOR",
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export enum ArtifactType {
  DOCUMENT = "DOCUMENT",
  BRANCH = "BRANCH",
  PR = "PR",
  FILE = "FILE",
  URL = "URL",
  CODE_SNIPPET = "CODE_SNIPPET",
}

export const QUEUE_NAMES: Record<AgentType, string> = {
  [AgentType.ORCHESTRATOR]: "agent-orchestrator",
  [AgentType.RESEARCH]: "agent-research",
  [AgentType.FRONTEND]: "agent-frontend",
  [AgentType.BACKEND]: "agent-backend",
  [AgentType.DEVOPS]: "agent-devops",
  [AgentType.PROMPTOPS]: "agent-promptops",
};
