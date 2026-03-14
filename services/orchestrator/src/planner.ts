import Anthropic from "@anthropic-ai/sdk";
import { AgentType } from "@wm/agent-core";
import type { MissionPlan, PlannedTask } from "@wm/agent-core";
import { createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "orchestrator", module: "planner" });

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
- PROMPTOPS: Improve prompts, agent instructions, LLM configurations

Rules:
1. Always start with a RESEARCH task unless the mission is purely operational
2. Use dependsOn[] to express sequential dependencies (use task index as string, e.g., "0" for first task)
3. Keep tasks focused — one agent type per task
4. Mark requiresApproval: true for tasks that will make irreversible changes (PR creation, deployments)
5. Return ONLY valid JSON matching the MissionPlan schema

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

  log.info({ missionTitle, taskCount: plan.tasks.length }, "Mission plan generated");
  return plan;
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
