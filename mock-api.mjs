// Simple mock API server — simulates the real Fastify API with fake data
import { createServer } from "http";

const MISSIONS = [];

const EVENTS = {};

const TASK_RUNS = {};

const APPROVALS = [];

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, "http://localhost:3001");
  const path = url.pathname;
  const method = req.method;

  let body = "";
  req.on("data", (chunk) => body += chunk);
  req.on("end", () => {
    // Health
    if (path === "/api/v1/health") {
      return json(res, { status: "ok", db: "ok (mock)", redis: "ok (mock)", timestamp: new Date().toISOString() });
    }

    // POST /missions
    if (method === "POST" && path === "/api/v1/missions") {
      const data = JSON.parse(body || "{}");
      const newMission = { id: `mission-${Date.now()}`, ...data, status: "NEW", tasks: [], artifacts: [], approvals: [], _count: { eventLogs: 1 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      MISSIONS.push(newMission);
      return json(res, newMission, 201);
    }

    // GET /missions
    if (method === "GET" && path === "/api/v1/missions") {
      const status = url.searchParams.get("status");
      const filtered = status ? MISSIONS.filter(m => m.status === status) : MISSIONS;
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const paginated = filtered.slice((page-1)*limit, page*limit);
      const withCount = paginated.map(m => ({ ...m, _count: { tasks: m.tasks.length } }));
      return json(res, { data: withCount, pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length/limit) } });
    }

    // GET /missions/:id
    const missionMatch = path.match(/^\/api\/v1\/missions\/([^/]+)$/);
    if (method === "GET" && missionMatch) {
      const mission = MISSIONS.find(m => m.id === missionMatch[1]);
      if (!mission) return json(res, { error: "Not found" }, 404);
      return json(res, mission);
    }

    // GET /missions/:id/tasks
    const tasksMatch = path.match(/^\/api\/v1\/missions\/([^/]+)\/tasks$/);
    if (method === "GET" && tasksMatch) {
      const mission = MISSIONS.find(m => m.id === tasksMatch[1]);
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
      const mission = MISSIONS.find(m => m.id === artifactsMatch[1]);
      return json(res, mission?.artifacts || []);
    }

    // PATCH /missions/:id/status
    const statusMatch = path.match(/^\/api\/v1\/missions\/([^/]+)\/status$/);
    if (method === "PATCH" && statusMatch) {
      const mission = MISSIONS.find(m => m.id === statusMatch[1]);
      if (!mission) return json(res, { error: "Not found" }, 404);
      const { status } = JSON.parse(body || "{}");
      mission.status = status;
      return json(res, mission);
    }

    // DELETE /missions/:id
    const deleteMatch = path.match(/^\/api\/v1\/missions\/([^/]+)$/);
    if (method === "DELETE" && deleteMatch) {
      const mission = MISSIONS.find(m => m.id === deleteMatch[1]);
      if (mission) mission.status = "CANCELLED";
      res.writeHead(204); res.end(); return;
    }

    // GET /tasks/:id/runs
    const runsMatch = path.match(/^\/api\/v1\/tasks\/([^/]+)\/runs$/);
    if (method === "GET" && runsMatch) {
      return json(res, TASK_RUNS[runsMatch[1]] || []);
    }

    // GET /approvals
    if (method === "GET" && path === "/api/v1/approvals") {
      return json(res, APPROVALS.filter(a => a.status === "PENDING"));
    }

    // POST /approvals/:id/resolve
    const resolveMatch = path.match(/^\/api\/v1\/approvals\/([^/]+)\/resolve$/);
    if (method === "POST" && resolveMatch) {
      const approval = APPROVALS.find(a => a.id === resolveMatch[1]);
      if (!approval) return json(res, { error: "Not found" }, 404);
      const { action, notes } = JSON.parse(body || "{}");
      approval.status = action === "approve" ? "APPROVED" : "REJECTED";
      approval.notes = notes || null;
      approval.resolvedAt = new Date().toISOString();
      return json(res, approval);
    }

    // SSE /events
    if (path === "/api/v1/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
      const allEvents = Object.values(EVENTS).flat().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      allEvents.forEach(e => res.write(`data: ${JSON.stringify(e)}\n\n`));
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
});
