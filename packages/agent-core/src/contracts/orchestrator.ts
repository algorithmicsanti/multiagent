import type { AgentType } from "../enums.js";

export interface PlannedTask {
  title: string;
  instructions: string;
  agentType: AgentType;
  dependsOn: string[];
  requiresApproval: boolean;
  timeoutSeconds: number;
  metadata?: Record<string, unknown>;
}

export interface MissionPlan {
  tasks: PlannedTask[];
  notes?: string;
}
