export const CENTRAL_ORCHESTRATOR_ID = "system-central-orchestrator";
export const TASK_TYPES = ["RESEARCH", "FRONTEND", "BACKEND", "DEVOPS", "PROMPTOPS"] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export type Actor = {
  id: string;
  displayName: string;
  key: string;
  kind: "HUMAN" | "AGENT" | "SYSTEM";
  role: string;
  context: string;
  supportedAgentTypes: string[];
  canBeAssignedDirectly: boolean;
};

export function buildActorGroups(actors: Actor[], taskType: string) {
  const central = actors.filter((actor) => actor.id === CENTRAL_ORCHESTRATOR_ID);
  const humans = actors.filter(
    (actor) =>
      actor.kind === "HUMAN" &&
      actor.canBeAssignedDirectly &&
      actor.supportedAgentTypes.includes(taskType)
  );
  const agents = actors.filter(
    (actor) =>
      actor.kind === "AGENT" &&
      actor.canBeAssignedDirectly &&
      actor.supportedAgentTypes.includes(taskType)
  );

  return { central, humans, agents };
}
