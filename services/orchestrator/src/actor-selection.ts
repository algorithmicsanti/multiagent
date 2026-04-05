import Anthropic from "@anthropic-ai/sdk";
import { createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "orchestrator", module: "actor-selection" });

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const ACTOR_SELECTION_SYSTEM_PROMPT = `You are the central delegation brain of Web Mentor Agent OS.
Choose the single best actor to execute a task.

Selection rules:
1. Prefer candidates whose supportedAgentTypes explicitly match the task type.
2. Prefer automatic agents for repeatable machine-executable work when they are a strong fit.
3. Prefer humans when judgement, product tradeoffs, or domain ownership are likely more important than automation.
4. Use each candidate's role and context seriously. Do not ignore them.
5. Return ONLY valid JSON: {"actorId":"string","reason":"string"}`;

function scoreActor(
  actor: {
    id: string;
    priority: number;
    kind: string;
    supportedAgentTypes: string[];
    runtimeAgentType: string | null;
  },
  taskAgentType: string
): number {
  let score = actor.priority;

  if (actor.supportedAgentTypes.includes(taskAgentType)) score += 50;
  if (actor.runtimeAgentType === taskAgentType) score += 25;
  if (actor.kind === "AGENT" && taskAgentType === "RESEARCH") score += 18;
  if (actor.kind === "AGENT" && taskAgentType === "PROMPTOPS") score += 12;
  if (actor.kind === "HUMAN" && ["FRONTEND", "BACKEND", "DEVOPS"].includes(taskAgentType)) {
    score += 10;
  }
  if (actor.kind === "AGENT" && actor.runtimeAgentType === "PROMPTOPS") score += 5;

  return score;
}

function parseSelection(text: string): { actorId: string; reason: string } | null {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlockMatch?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as { actorId?: string; reason?: string };
    if (!parsed.actorId) return null;
    return {
      actorId: parsed.actorId,
      reason: parsed.reason ?? "Selected by LLM delegation",
    };
  } catch {
    return null;
  }
}

export async function selectBestActorForTask(args: {
  missionTitle: string;
  missionDescription: string;
  taskTitle: string;
  taskInstructions: string;
  taskAgentType: string;
  candidates: Array<{
    id: string;
    displayName: string;
    kind: string;
    role: string;
    context: string;
    supportedAgentTypes: string[];
    runtimeAgentType: string | null;
    priority: number;
  }>;
}): Promise<{ actorId: string; reason: string }> {
  const supportedCandidates = args.candidates.filter((candidate) =>
    candidate.supportedAgentTypes.includes(args.taskAgentType)
  );
  const pool = supportedCandidates.length > 0 ? supportedCandidates : args.candidates;

  if (pool.length === 0) {
    throw new Error("No delegation candidates available");
  }

  if (pool.length === 1) {
    const onlyCandidate = pool[0]!;
    return {
      actorId: onlyCandidate.id,
      reason: `Only eligible candidate available: ${onlyCandidate.displayName}`,
    };
  }

  if (client) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: ACTOR_SELECTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              `Mission: ${args.missionTitle}`,
              `Mission description: ${args.missionDescription}`,
              `Task title: ${args.taskTitle}`,
              `Task type: ${args.taskAgentType}`,
              `Task instructions:\n${args.taskInstructions}`,
              "",
              "Candidates:",
              ...pool.map((candidate) =>
                [
                  `- actorId: ${candidate.id}`,
                  `  displayName: ${candidate.displayName}`,
                  `  kind: ${candidate.kind}`,
                  `  role: ${candidate.role}`,
                  `  context: ${candidate.context}`,
                  `  supportedAgentTypes: ${candidate.supportedAgentTypes.join(", ")}`,
                  `  runtimeAgentType: ${candidate.runtimeAgentType ?? "manual"}`,
                  `  priority: ${candidate.priority}`,
                ].join("\n")
              ),
            ].join("\n"),
          },
        ],
      });

      const content = message.content[0];
      if (content?.type === "text") {
        const parsed = parseSelection(content.text);
        if (parsed && pool.some((candidate) => candidate.id === parsed.actorId)) {
          return parsed;
        }
      }
    } catch (error) {
      log.warn({ err: error, taskTitle: args.taskTitle }, "LLM actor selection failed, falling back to heuristic");
    }
  }

  const heuristicChoice = [...pool].sort(
    (left, right) => scoreActor(right, args.taskAgentType) - scoreActor(left, args.taskAgentType)
  )[0]!;

  return {
    actorId: heuristicChoice.id,
    reason: `Heuristic selection based on supported skill match, priority and execution mode: ${heuristicChoice.displayName}`,
  };
}
