import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@wm/db";
import type { AgentJobPayload, WorkerResult } from "@wm/agent-core";
import { ArtifactType } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";
import { notifyTaskCompleted } from "./telegram.js";

const log = createChildLogger({ service: "worker-research" });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESEARCH_SYSTEM_PROMPT = `You are the Research Agent for Web Mentor Agent OS.
Your job is to investigate, analyze, and produce structured research that other agents will use.

When given instructions, you must:
1. Analyze the request thoroughly
2. Provide concrete, actionable findings
3. Structure your output as a research document
4. Include specific recommendations for frontend/backend changes if relevant
5. Note any risks or blockers discovered

Return your response in the following JSON format:
{
  "summary": "1-2 sentence summary of findings",
  "findings": [
    { "area": "string", "finding": "string", "recommendation": "string" }
  ],
  "risks": ["string"],
  "nextSteps": ["string"],
  "rawResearch": "full research text"
}`;

export async function processResearchJob(payload: AgentJobPayload): Promise<WorkerResult> {
  const { taskId, missionId, runId, instructions, context } = payload;

  log.info({ taskId, missionId }, "Processing research job");

  // Mark task as running
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "RUNNING" },
  });
  await prisma.taskRun.update({
    where: { id: runId },
    data: { status: "running", startedAt: new Date() },
  });
  await logEvent(prisma, {
    eventType: EVENT_TYPES.TASK_STARTED,
    missionId,
    taskId,
    payload: { taskId, runId },
  });

  const startTime = Date.now();

  try {
    const userMessage = `Mission: ${context.missionTitle}
Description: ${context.missionDescription}

Task Instructions:
${instructions}

${
  context.previousArtifacts.length > 0
    ? `\nPrevious artifacts available:\n${context.previousArtifacts
        .map((a) => `- ${a.artifactType}: ${a.pathOrUrl}`)
        .join("\n")}`
    : ""
}

${
  context.completedTaskSummaries.length > 0
    ? `\nCompleted tasks:\n${context.completedTaskSummaries
        .map((t) => `- ${t.title}: ${t.summary}`)
        .join("\n")}`
    : ""
}

Produce your research now.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: RESEARCH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Unexpected response type from LLM");
    }

    const text = content.text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
    const jsonText = jsonMatch[1]?.trim() ?? text.trim();

    let researchOutput: Record<string, unknown>;
    try {
      researchOutput = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      // If JSON parsing fails, wrap the raw text
      researchOutput = {
        summary: "Research completed (unstructured)",
        rawResearch: text,
        findings: [],
        risks: [],
        nextSteps: [],
      };
    }

    const durationMs = Date.now() - startTime;
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
    const costUsd = (tokensUsed / 1_000_000) * 3.0; // Sonnet pricing approx

    // Update task run
    await prisma.taskRun.update({
      where: { id: runId },
      data: {
        outputPayload: researchOutput,
        finishedAt: new Date(),
        status: "completed",
        durationMs,
        tokensUsed,
        costUsd: String(costUsd),
      },
    });

    // Mark task as completed
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "COMPLETED" },
    });

    // Register artifact
    const summary = typeof researchOutput.summary === "string"
      ? researchOutput.summary
      : "Research document";

    const artifact = await prisma.artifact.create({
      data: {
        missionId,
        taskId,
        artifactType: ArtifactType.DOCUMENT,
        pathOrUrl: `research/${taskId}.json`,
        metadata: { summary, tokensUsed, durationMs },
      },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.ARTIFACT_CREATED,
      missionId,
      taskId,
      payload: { artifactId: artifact.id, artifactType: ArtifactType.DOCUMENT },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_COMPLETED,
      missionId,
      taskId,
      payload: { taskId, runId, summary, durationMs, tokensUsed },
    });

    log.info({ taskId, durationMs, tokensUsed }, "Research task completed");

    const taskInfo = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
    await notifyTaskCompleted({
      missionId,
      taskId,
      taskTitle: taskInfo?.title ?? "Research task",
      summary,
    });

    return {
      status: "completed",
      summary,
      outputPayload: researchOutput,
      artifacts: [
        {
          artifactType: ArtifactType.DOCUMENT,
          pathOrUrl: `research/${taskId}.json`,
          metadata: { summary },
        },
      ],
      tokensUsed,
      costUsd,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : String(err);

    await prisma.taskRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        status: "failed",
        errorMessage: errMsg,
        durationMs,
      },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "FAILED", retries: { increment: 1 } },
    });

    await logEvent(prisma, {
      eventType: EVENT_TYPES.TASK_FAILED,
      missionId,
      taskId,
      payload: { taskId, runId, error: errMsg, durationMs },
    });

    log.error({ taskId, err }, "Research task failed");

    return {
      status: "failed",
      summary: `Research failed: ${errMsg}`,
      outputPayload: {},
      error: { message: errMsg, stack: err instanceof Error ? err.stack : undefined },
    };
  }
}
