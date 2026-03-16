// Simple mock API server that simulates the real Fastify API with evolving state
import { createServer } from "http";

const MISSIONS = [];
const EVENTS = {};
const TASK_RUNS = {};
const APPROVALS = [];

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function pushEvent(missionId, eventType, payload = {}) {
  if (!EVENTS[missionId]) EVENTS[missionId] = [];
  const event = {
    id: randomId("evt"),
    missionId,
    eventType,
    payload,
    createdAt: nowIso(),
  };
  EVENTS[missionId].push(event);
  return event;
}

function upsertRun(taskId, runPatch) {
  if (!TASK_RUNS[taskId]) TASK_RUNS[taskId] = [];
  const existing = TASK_RUNS[taskId][0];
  if (!existing) {
    const run = {
      id: randomId("run"),
      taskId,
      status: "RUNNING",
      workerName: "worker-research",
      startedAt: nowIso(),
      ...runPatch,
    };
    TASK_RUNS[taskId].unshift(run);
    return run;
  }
  Object.assign(existing, runPatch);
  return existing;
}

function createTask(mission, data) {
  const task = {
    id: randomId("task"),
    missionId: mission.id,
    status: "NEW",
    retries: 0,
    maxRetries: 3,
    timeoutSeconds: 300,
    dependsOn: [],
    metadata: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...data,
  };
  mission.tasks.push(task);
  mission.updatedAt = nowIso();
  return task;
}

function simulateMissionLifecycle(mission) {
  pushEvent(mission.id, "MISSION_CREATED", { title: mission.title });

  setTimeout(() => {
    mission.status = "PLANNING";
    mission.updatedAt = nowIso();
    pushEvent(mission.id, "MISSION_PLANNING_STARTED", {
      message: "Orchestrator analyzing mission objective",
    });

    const researchTask = createTask(mission, {
      agentType: "RESEARCH",
      title: `Analyze objective for: ${mission.title}`,
      instructions: mission.description || "Analyze scope and constraints.",
      requiresApproval: false,
    });

    const implementationTask = createTask(mission, {
      agentType: "AUTOMATION",
      title: `Build execution plan for: ${mission.title}`,
      instructions: "Generate implementation steps and validations.",
      requiresApproval: true,
      dependsOn: [researchTask.id],
    });

    pushEvent(mission.id, "TASKS_GENERATED", {
      taskCount: mission.tasks.length,
      tasks: mission.tasks.map((t) => ({ id: t.id, title: t.title, agentType: t.agentType })),
    });

    mission.status = "RUNNING";
    researchTask.status = "RUNNING";
    researchTask.updatedAt = nowIso();
    upsertRun(researchTask.id, {
      status: "RUNNING",
      workerName: "worker-research",
      startedAt: nowIso(),
      tokensUsed: 430,
    });
    pushEvent(mission.id, "TASK_STARTED", {
      taskId: researchTask.id,
      worker: "worker-research",
    });

    setTimeout(() => {
      researchTask.status = "DONE";
      researchTask.updatedAt = nowIso();
      upsertRun(researchTask.id, {
        status: "DONE",
        finishedAt: nowIso(),
        durationMs: 3200,
        costUsd: "0.0042",
        outputPayload: {
          summary: "Research complete. Constraints and risks identified.",
          nextStep: "Requires approval before implementation plan execution.",
        },
      });
      pushEvent(mission.id, "TASK_COMPLETED", {
        taskId: researchTask.id,
      });

      mission.status = "WAITING_APPROVAL";
      implementationTask.status = "WAITING_APPROVAL";
      implementationTask.updatedAt = nowIso();
      const approval = {
        id: randomId("approval"),
        missionId: mission.id,
        taskId: implementationTask.id,
        title: `Approve execution: ${implementationTask.title}`,
        reason: "Plan affects automated execution path.",
        status: "PENDING",
        createdAt: nowIso(),
        notes: null,
        resolvedAt: null,
      };
      APPROVALS.push(approval);
      mission.approvals.push(approval.id);
      mission.updatedAt = nowIso();
      pushEvent(mission.id, "APPROVAL_REQUIRED", {
        approvalId: approval.id,
        taskId: implementationTask.id,
      });
    }, 2200);
  }, 1200);
}

function continueAfterApproval(approval, approved, notes) {
  const mission = MISSIONS.find((m) => m.id === approval.missionId);
  if (!mission) return;
  const task = mission.tasks.find((t) => t.id === approval.taskId);
  if (!task) return;

  if (!approved) {
    task.status = "FAILED";
    task.updatedAt = nowIso();
    mission.status = "FAILED";
    mission.updatedAt = nowIso();
    pushEvent(mission.id, "APPROVAL_REJECTED", {
      approvalId: approval.id,
      notes,
    });
    return;
  }

  mission.status = "RUNNING";
  task.status = "RUNNING";
  task.updatedAt = nowIso();
  mission.updatedAt = nowIso();
  upsertRun(task.id, {
    status: "RUNNING",
    workerName: "worker-orchestrator",
    startedAt: nowIso(),
    tokensUsed: 980,
  });
  pushEvent(mission.id, "APPROVAL_ACCEPTED", {
    approvalId: approval.id,
  });

  setTimeout(() => {
    task.status = "DONE";
    task.updatedAt = nowIso();
    upsertRun(task.id, {
      status: "DONE",
      finishedAt: nowIso(),
      durationMs: 4100,
      costUsd: "0.0108",
      outputPayload: {
        summary: "Execution plan produced and validated.",
        checklist: [
          "Scope confirmed",
          "Dependencies mapped",
          "Risk mitigations attached",
        ],
      },
    });
    mission.status = "DONE";
    mission.updatedAt = nowIso();
    mission.artifacts.push({
      id: randomId("artifact"),
      artifactType: "REPORT",
      pathOrUrl: `/artifacts/${mission.id}/execution-plan.md`,
      createdAt: nowIso(),
    });
    pushEvent(mission.id, "MISSION_COMPLETED", {
      missionId: mission.id,
    });
  }, 2500);
}

const server = createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost:3001");
  const path = url.pathname;
  const method = req.method;

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    // Health
    if (path === "/api/v1/health") {
      return json(res, {
        status: "ok",
        db: "ok (mock)",
        redis: "ok (mock)",
        timestamp: nowIso(),
      });
    }

    // POST /missions
    if (method === "POST" && path === "/api/v1/missions") {
      const data = JSON.parse(body || "{}");
      const newMission = {
        id: randomId("mission"),
        title: data.title || "Untitled mission",
        description: data.description || "",
        priority: Number(data.priority || 5),
        createdBy: data.createdBy || "admin",
        budgetLimit: data.budgetLimit ?? null,
        status: "NEW",
        tasks: [],
        artifacts: [],
        approvals: [],
        _count: { eventLogs: 0 },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      MISSIONS.push(newMission);
      simulateMissionLifecycle(newMission);
      return json(res, newMission, 201);
    }

    // GET /missions
    if (method === "GET" && path === "/api/v1/missions") {
      const status = url.searchParams.get("status");
      const filtered = status ? MISSIONS.filter((m) => m.status === status) : MISSIONS;
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      const withCount = paginated.map((m) => ({ ...m, _count: { tasks: m.tasks.length } }));
      return json(res, {
        data: withCount,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    }

    // DELETE /missions (reset all)
    if (method === "DELETE" && path === "/api/v1/missions") {
      MISSIONS.splice(0, MISSIONS.length);
      APPROVALS.splice(0, APPROVALS.length);
      for (const key of Object.keys(EVENTS)) delete EVENTS[key];
      for (const key of Object.keys(TASK_RUNS)) delete TASK_RUNS[key];
      return json(res, { ok: true, deleted: "all" });
    }

    // GET /missions/:id
    const missionMatch = path.match(/^\/api\/v1\/missions\/([^/]+)$/);
    if (method === "GET" && missionMatch) {
      const mission = MISSIONS.find((m) => m.id === missionMatch[1]);
      if (!mission) return json(res, { error: "Not found" }, 404);
      return json(res, mission);
    }

    // GET /missions/:id/tasks
    const tasksMatch = path.match(/^\/api\/v1\/missions\/([^/]+)\/tasks$/);
    if (method === "GET" && tasksMatch) {
      const mission = MISSIONS.find((m) => m.id === tasksMatch[1]);
      return json(res, mission?.tasks || []);
    }

    // GET /missions/:id/events
    const eventsMatch = path.match(/^\/api\/v1\/missions\/([^/]+)\/events$/);
    if (method === "GET" && eventsMatch) {
      return json(res, EVENTS[eventsMatch[1]] || []);
    }

    // GET /missions/:id/artifacts
    const artifactsMatch = path.match(/^\/api\/v1\/missions\/([^/]+)\/artifacts$/);
    if (method === "GET" && artifactsMatch) {
      const mission = MISSIONS.find((m) => m.id === artifactsMatch[1]);
      return json(res, mission?.artifacts || []);
    }

    // PATCH /missions/:id/status
    const statusMatch = path.match(/^\/api\/v1\/missions\/([^/]+)\/status$/);
    if (method === "PATCH" && statusMatch) {
      const mission = MISSIONS.find((m) => m.id === statusMatch[1]);
      if (!mission) return json(res, { error: "Not found" }, 404);
      const { status } = JSON.parse(body || "{}");
      mission.status = status;
      mission.updatedAt = nowIso();
      pushEvent(mission.id, "MISSION_STATUS_PATCHED", { status });
      return json(res, mission);
    }

    // DELETE /missions/:id
    const deleteMatch = path.match(/^\/api\/v1\/missions\/([^/]+)$/);
    if (method === "DELETE" && deleteMatch) {
      const mission = MISSIONS.find((m) => m.id === deleteMatch[1]);
      if (mission) {
        mission.status = "FAILED";
        mission.updatedAt = nowIso();
        pushEvent(mission.id, "MISSION_CANCELLED", {});
      }
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /tasks/:id/runs
    const runsMatch = path.match(/^\/api\/v1\/tasks\/([^/]+)\/runs$/);
    if (method === "GET" && runsMatch) {
      return json(res, TASK_RUNS[runsMatch[1]] || []);
    }

    // GET /approvals
    if (method === "GET" && path === "/api/v1/approvals") {
      return json(res, APPROVALS.filter((a) => a.status === "PENDING"));
    }

    // POST /approvals/:id/resolve
    const resolveMatch = path.match(/^\/api\/v1\/approvals\/([^/]+)\/resolve$/);
    if (method === "POST" && resolveMatch) {
      const approval = APPROVALS.find((a) => a.id === resolveMatch[1]);
      if (!approval) return json(res, { error: "Not found" }, 404);

      const { action, notes } = JSON.parse(body || "{}");
      const approved = action === "approve";
      approval.status = approved ? "APPROVED" : "REJECTED";
      approval.notes = notes || null;
      approval.resolvedAt = nowIso();
      continueAfterApproval(approval, approved, notes || null);
      return json(res, approval);
    }

    // SSE /events
    if (path === "/api/v1/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const allEvents = Object.values(EVENTS)
        .flat()
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      allEvents.forEach((e) => {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      });
      return;
    }

    json(res, { error: "Not found" }, 404);
  });
});

server.listen(3001, () => {
  console.log("Mock API running at http://localhost:3001");
  console.log("  GET  /api/v1/health");
  console.log("  GET  /api/v1/missions");
  console.log("  POST /api/v1/missions");
  console.log("  GET  /api/v1/approvals");
  console.log("  POST /api/v1/approvals/:id/resolve");
});
