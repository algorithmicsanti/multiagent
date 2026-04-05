import Anthropic from "@anthropic-ai/sdk";
import { prisma, Prisma } from "@wm/db";
import type { AgentJobPayload, WorkerResult } from "@wm/agent-core";
import { ArtifactType } from "@wm/agent-core";
import { logEvent, EVENT_TYPES, createChildLogger } from "@wm/observability";

const log = createChildLogger({ service: "worker-promptops" });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPTOPS_SYSTEM_PROMPT = `You are the PromptOps and efficiency optimization worker for Web Mentor Agent OS.
Your mission is to optimize execution efficiency, compute usage, worker reuse, and plan quality without removing necessary steps.

Core rules:
1. Do not eliminate necessary steps. Preserve them and optimize how they are executed.
2. Identify duplicated work, reusable context, and opportunities to consolidate agent effort.
3. If the original requested agent type has no dedicated worker, produce the best executable strategy using the available system capabilities.
4. When a specialized task appears more than once, propose a reusable worker or reusable execution pattern.
5. Focus on both effectiveness and resource efficiency.

Return ONLY valid JSON in this shape:
{
  "summary": "short summary",
  "executionStrategy": "string",
  "preservedNecessarySteps": ["string"],
  "optimizations": [
    { "area": "string", "change": "string", "benefit": "string" }
  ],
  "workerStrategy": {
    "requestedAgentType": "string",
    "executionAgentType": "string",
    "reason": "string"
  },
  "nextSteps": ["string"],
  "rawPlan": "string"
}`;

const PROMPTOPS_REPORT_SYSTEM_PROMPT = `You are a report synthesis agent.
You must produce the final business deliverable requested by the task instructions.
Do NOT describe process, strategy, optimization steps, or worker orchestration.
Do NOT output JSON unless explicitly asked.
Return ONLY the final Markdown report for humans.`;

function isHumanReportTask(instructions: string): boolean {
  const i = instructions.toLowerCase();
  return (
    i.includes("top 5 automatizaciones") ||
    i.includes("formato de entrega") ||
    i.includes("tabla comparativa") ||
    i.includes("resumen ejecutivo") ||
    i.includes("recomendación de arranque")
  );
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

function buildHumanMarkdown(output: Record<string, unknown>): string {
  const summary = typeof output.summary === "string" ? output.summary : "Sin resumen";
  const strategy = typeof output.executionStrategy === "string" ? output.executionStrategy : "Sin estrategia detallada";
  const nextSteps = toStringArray(output.nextSteps);

  const optimizations = Array.isArray(output.optimizations)
    ? output.optimizations
        .map((item, idx) => {
          if (!item || typeof item !== "object") return `${idx + 1}. Optimización ${idx + 1}`;
          const row = item as Record<string, unknown>;
          const area = String(row.area ?? `Área ${idx + 1}`);
          const change = String(row.change ?? "cambio no especificado");
          const benefit = String(row.benefit ?? "beneficio no especificado");
          return `${idx + 1}. **${area}** — ${change} (beneficio: ${benefit})`;
        })
        .filter(Boolean)
    : [];

  return [
    "## Resumen ejecutivo",
    summary,
    "",
    "## Estrategia recomendada",
    strategy,
    "",
    "## Optimizaciones clave",
    ...(optimizations.length ? optimizations : ["1. Sin optimizaciones explícitas reportadas"]),
    "",
    "## Siguientes pasos",
    ...(nextSteps.length ? nextSteps.map((s, i) => `${i + 1}. ${s}`) : ["1. Ejecutar siguiente fase operativa"]),
    "",
    "---",
    "### Detalles técnicos (JSON)",
    "```json",
    JSON.stringify(output, null, 2),
    "```",
  ].join("\n");
}

export async function processPromptOpsJob(payload: AgentJobPayload): Promise<WorkerResult> {
  const { taskId, missionId, runId, instructions, context } = payload;

  log.info({ taskId, missionId }, "Processing promptops job");

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
    const reportMode = isHumanReportTask(instructions);

    const userMessage = `Mission: ${context.missionTitle}
Description: ${context.missionDescription}

Task instructions:
${instructions}

Previous artifacts:
${context.previousArtifacts.map((a: { artifactType: string; pathOrUrl: string }) => `- ${a.artifactType}: ${a.pathOrUrl}`).join("\n") || "None"}

Completed tasks:
${context.completedTaskSummaries.map((t: { title: string; summary: string }) => `- ${t.title}: ${t.summary}`).join("\n") || "None"}

${reportMode ? "Produce the final human-facing Markdown report now." : "Produce an execution optimization strategy now."}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: reportMode ? PROMPTOPS_REPORT_SYSTEM_PROMPT : PROMPTOPS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Unexpected response type from LLM");
    }

    const text = content.text;

    let output: Record<string, unknown>;
    if (reportMode) {
      const markdown = text.trim();
      output = {
        summary: "Reporte human-first generado",
        markdown,
      };
    } else {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
      const jsonText = jsonMatch[1]?.trim() ?? text.trim();
      try {
        output = JSON.parse(jsonText) as Record<string, unknown>;
      } catch {
        output = {
          summary: "PromptOps optimization completed (unstructured)",
          executionStrategy: text,
          preservedNecessarySteps: [],
          optimizations: [],
          nextSteps: [],
          rawPlan: text,
        };
      }

      const markdownReport = buildHumanMarkdown(output);
      output.markdown = markdownReport;
    }

    const durationMs = Date.now() - startTime;
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
    const costUsd = (tokensUsed / 1_000_000) * 3.0;

    await prisma.taskRun.update({
      where: { id: runId },
      data: {
        outputPayload: output as Prisma.InputJsonValue,
        finishedAt: new Date(),
        status: "completed",
        durationMs,
        tokensUsed,
        costUsd: String(costUsd),
      },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "COMPLETED" },
    });

    const summary = typeof output.summary === "string"
      ? output.summary
      : "PromptOps optimization result";

    const artifact = await prisma.artifact.create({
      data: {
        missionId,
        taskId,
        artifactType: ArtifactType.DOCUMENT,
        pathOrUrl: `promptops/${taskId}.md`,
        metadata: { summary, tokensUsed, durationMs, format: "markdown" },
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

    return {
      status: "completed",
      summary,
      outputPayload: output,
      artifacts: [
        {
          artifactType: ArtifactType.DOCUMENT,
          pathOrUrl: `promptops/${taskId}.md`,
          metadata: { summary, format: "markdown" },
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

    log.error({ taskId, err }, "PromptOps task failed");

    return {
      status: "failed",
      summary: `PromptOps failed: ${errMsg}`,
      outputPayload: {},
      error: err instanceof Error && err.stack
        ? { message: errMsg, stack: err.stack }
        : { message: errMsg },
    };
  }
}
