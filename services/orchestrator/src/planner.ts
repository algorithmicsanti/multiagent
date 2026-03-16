import Anthropic from "@anthropic-ai/sdk";
import { AgentType } from "@wm/agent-core";
import type { MissionPlan, PlannedTask } from "@wm/agent-core";
import { createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "orchestrator", module: "planner" });
const EXECUTABLE_AGENT_TYPES = new Set([AgentType.RESEARCH, AgentType.PROMPTOPS]);

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PLANNING_SYSTEM_PROMPT = `You are the master orchestrator of Web Mentor Agent OS.
Your job is to decompose a business mission into a sequence of concrete tasks for specialized agents.

Available agent types:
- RESEARCH: Investigate technologies, documentation, best practices, competitors
- FRONTEND: Analyze and propose frontend code changes (React, Next.js, CSS)
- BACKEND: Analyze and propose backend code changes (APIs, services, databases)
- DEVOPS: Infrastructure, deployment, CI/CD, Docker, monitoring
- PROMPTOPS: Optimize execution efficiency, worker reuse, computational cost, plan quality, and prompt/agent strategy without removing necessary steps

Rules:
1. Always start with a RESEARCH task unless the mission is purely operational
2. Use dependsOn[] to express sequential dependencies (use task index as string, e.g., "0" for first task)
3. Keep tasks focused — one agent type per task
4. Mark requiresApproval: false always.
5. If the mission will likely need multiple workers or repeated specialized work, include a PROMPTOPS optimization task early in the plan
6. Do not remove necessary steps; optimize them while preserving effectiveness
7. Return ONLY valid JSON matching the MissionPlan schema

MissionPlan schema:
{
  "tasks": [
    {
      "title": "string",
      "instructions": "string (detailed instructions for the agent)",
      "agentType": "RESEARCH|FRONTEND|BACKEND|DEVOPS|PROMPTOPS",
      "dependsOn": ["0", "1", ...],
      "requiresApproval": boolean,
      "timeoutSeconds": number,
      "metadata": {}
    }
  ],
  "notes": "optional string"
}`;

function shiftDependencyIndex(dep: string, fromIndex: number) {
  const parsed = Number.parseInt(dep, 10);
  if (Number.isNaN(parsed)) return dep;
  return parsed >= fromIndex ? String(parsed + 1) : dep;
}

function normalizeMissionPlan(plan: MissionPlan): MissionPlan {
  const tasks = plan.tasks.map((task) => ({
    ...task,
    dependsOn: [...task.dependsOn],
    metadata: task.metadata ? { ...task.metadata } : undefined,
  }));

  const unsupportedCounts = new Map<AgentType, number>();
  for (const task of tasks) {
    if (!EXECUTABLE_AGENT_TYPES.has(task.agentType)) {
      unsupportedCounts.set(task.agentType, (unsupportedCounts.get(task.agentType) ?? 0) + 1);
    }
  }

  const repeatedUnsupportedWork = [...unsupportedCounts.values()].some((count) => count > 1);
  const hasPromptOpsTask = tasks.some((task) => task.agentType === AgentType.PROMPTOPS);
  const needsOptimizerTask = !hasPromptOpsTask && (tasks.length > 1 || repeatedUnsupportedWork);

  let optimizerIndex = tasks.findIndex((task) => task.agentType === AgentType.PROMPTOPS);
  if (needsOptimizerTask) {
    const insertIndex = tasks[0]?.agentType === AgentType.RESEARCH ? 1 : 0;
    const optimizerTask: PlannedTask = {
      title: "Optimize worker strategy and execution efficiency",
      instructions: [
        "Analyze the full mission plan for worker reuse, compute efficiency, and execution effectiveness.",
        "Preserve any necessary steps. Do not eliminate required work.",
        "If specialized agent work is repeated and no dedicated worker exists, define the execution strategy to absorb that work safely.",
        "Produce a concise plan that minimizes redundant compute and maximizes mission completion reliability.",
      ].join(" "),
      agentType: AgentType.PROMPTOPS,
      dependsOn: insertIndex === 1 ? ["0"] : [],
      requiresApproval: false,
      timeoutSeconds: 300,
      metadata: {
        optimizer: true,
        reason: repeatedUnsupportedWork ? "repeated-unsupported-agent-work" : "multi-step-mission",
      },
    };

    for (const task of tasks) {
      task.dependsOn = task.dependsOn.map((dep) => shiftDependencyIndex(dep, insertIndex));
    }

    tasks.splice(insertIndex, 0, optimizerTask);
    optimizerIndex = insertIndex;
  }

  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index]!;
    if (optimizerIndex >= 0 && index > optimizerIndex && index !== optimizerIndex && task.agentType !== AgentType.RESEARCH) {
      const optimizerDep = String(optimizerIndex);
      if (!task.dependsOn.includes(optimizerDep)) {
        task.dependsOn.push(optimizerDep);
      }
    }

    if (!EXECUTABLE_AGENT_TYPES.has(task.agentType)) {
      const originalAgentType = task.agentType;
      task.instructions = [
        `Original requested agent type: ${originalAgentType}.`,
        "No dedicated runtime worker is currently available for that agent type.",
        "Execute this through PromptOps, keeping all necessary work but optimizing compute usage, worker reuse, and overall effectiveness.",
        task.instructions,
      ].join(" ");
      task.metadata = {
        ...(task.metadata ?? {}),
        originalAgentType,
        routedByPlanner: true,
        executionAgentType: AgentType.PROMPTOPS,
        repeatedUsageCount: unsupportedCounts.get(originalAgentType) ?? 1,
      };
      task.agentType = AgentType.PROMPTOPS;
    }
  }

  return {
    ...plan,
    tasks,
    notes: [
      plan.notes,
      needsOptimizerTask ? "Planner injected PromptOps optimization task." : null,
      repeatedUnsupportedWork ? "Unsupported repeated agent work was routed through PromptOps." : null,
    ].filter(Boolean).join(" "),
  };
}

export async function generateMissionPlan(
  missionTitle: string,
  missionDescription: string
): Promise<MissionPlan> {
  log.info({ missionTitle }, "Generating mission plan");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: PLANNING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Mission Title: ${missionTitle}\n\nMission Description:\n${missionDescription}\n\nGenerate a detailed mission plan as JSON.`,
      },
    ],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") {
    throw new Error("Unexpected response from LLM");
  }

  // Extract JSON from response (handle markdown code blocks)
  const text = content.text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const jsonText = jsonMatch[1]?.trim() ?? text.trim();

  let plan: MissionPlan;
  try {
    plan = JSON.parse(jsonText) as MissionPlan;
  } catch {
    log.error({ text }, "Failed to parse LLM plan response");
    throw new Error("Failed to parse mission plan from LLM response");
  }

  const normalizedPlan = normalizeMissionPlan(plan);

  log.info({ missionTitle, taskCount: normalizedPlan.tasks.length }, "Mission plan generated");
  return normalizedPlan;
}

export function resolveTaskDependencies(
  plannedTasks: PlannedTask[],
  createdTaskIds: string[]
): { title: string; dependsOn: string[] }[] {
  return plannedTasks.map((task, i) => ({
    title: task.title,
    dependsOn: task.dependsOn
      .map((dep) => {
        const idx = parseInt(dep, 10);
        return createdTaskIds[idx] ?? null;
      })
      .filter((id): id is string => id !== null),
  }));
}
