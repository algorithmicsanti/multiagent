// Simple mock API server — simulates the real Fastify API with fake data
import { createServer } from "http";

const MISSIONS = [
  {
    id: "mission-001",
    title: "Mejorar rendimiento del checkout",
    description: "Analizar y optimizar el flujo de checkout para reducir tiempo de carga en 50%",
    status: "REVIEWING",
    priority: 9,
    createdBy: "santiago",
    currentStep: null,
    budgetLimit: "50.0000",
    metadata: null,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    tasks: [
      {
        id: "task-001",
        missionId: "mission-001",
        agentType: "RESEARCH",
        title: "Investigar bottlenecks del checkout",
        instructions: "Analiza el código del checkout y documenta los puntos de lentitud",
        status: "COMPLETED",
        retries: 0,
        maxRetries: 3,
        timeoutSeconds: 300,
        requiresApproval: false,
        dependsOn: [],
        metadata: null,
        createdAt: new Date(Date.now() - 3600000 * 1.8).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "task-002",
        missionId: "mission-001",
        agentType: "FRONTEND",
        title: "Proponer optimizaciones frontend",
        instructions: "Basado en la investigación, proponer cambios en React components",
        status: "COMPLETED",
        retries: 0,
        maxRetries: 3,
        timeoutSeconds: 300,
        requiresApproval: true,
        dependsOn: ["task-001"],
        metadata: null,
        createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    artifacts: [
      {
        id: "artifact-001",
        missionId: "mission-001",
        taskId: "task-001",
        artifactType: "DOCUMENT",
        pathOrUrl: "research/task-001.json",
        metadata: { summary: "Encontrados 3 bottlenecks principales: queries N+1, imágenes sin lazy loading, bundle size excesivo" },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "artifact-002",
        missionId: "mission-001",
        taskId: "task-002",
        artifactType: "CODE_SNIPPET",
        pathOrUrl: "proposals/checkout-optimization.diff",
        metadata: { summary: "Propuesta de optimización con lazy loading y código splitting" },
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    approvals: [],
    _count: { eventLogs: 8 },
  },
  {
    id: "mission-002",
    title: "Integrar autenticación con Google OAuth",
    description: "Agregar login con Google al sistema de usuarios existente",
    status: "RUNNING",
    priority: 7,
    createdBy: "santiago",
    currentStep: "RESEARCH",
    budgetLimit: null,
    metadata: null,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    tasks: [
      {
        id: "task-003",
        missionId: "mission-002",
        agentType: "RESEARCH",
        title: "Investigar Google OAuth 2.0 integration",
        instructions: "Documentar pasos para integrar Google OAuth con el stack actual",
        status: "COMPLETED",
        retries: 0,
        maxRetries: 3,
        timeoutSeconds: 300,
        requiresApproval: false,
        dependsOn: [],
        metadata: null,
        createdAt: new Date(Date.now() - 1500000).toISOString(),
        updatedAt: new Date(Date.now() - 900000).toISOString(),
      },
      {
        id: "task-004",
        missionId: "mission-002",
        agentType: "BACKEND",
        title: "Implementar endpoint OAuth callback",
        instructions: "Crear el endpoint /auth/google/callback en la API",
        status: "RUNNING",
        retries: 0,
        maxRetries: 3,
        timeoutSeconds: 600,
        requiresApproval: false,
        dependsOn: ["task-003"],
        metadata: null,
        createdAt: new Date(Date.now() - 600000).toISOString(),
        updatedAt: new Date(Date.now() - 60000).toISOString(),
      },
    ],
    artifacts: [
      {
        id: "artifact-003",
        missionId: "mission-002",
        taskId: "task-003",
        artifactType: "DOCUMENT",
        pathOrUrl: "research/task-003.json",
        metadata: { summary: "Google OAuth 2.0 flow documentado. Requiere: google-auth-library, callback URL, env vars CLIENT_ID y CLIENT_SECRET" },
        createdAt: new Date(Date.now() - 900000).toISOString(),
      },
    ],
    approvals: [],
    _count: { eventLogs: 5 },
  },
  {
    id: "mission-003",
    title: "Optimizar pipeline de CI/CD",
    description: "Reducir tiempo de build de 12 minutos a menos de 5 minutos",
    status: "NEW",
    priority: 5,
    createdBy: "german",
    currentStep: null,
    budgetLimit: null,
    metadata: null,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    tasks: [],
    artifacts: [],
    approvals: [],
    _count: { eventLogs: 1 },
  },
  {
    id: "mission-004",
    title: "Revisar prompts del agente de onboarding",
    description: "Mejorar la calidad de las respuestas del agente de onboarding de usuarios nuevos",
    status: "WAITING_APPROVAL",
    priority: 6,
    createdBy: "santiago",
    currentStep: null,
    budgetLimit: "20.0000",
    metadata: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    tasks: [],
    artifacts: [],
    approvals: [
      {
        id: "approval-001",
        missionId: "mission-004",
        taskId: "task-005",
        actionType: "DEPLOY_PROMPT_UPDATE",
        requestedBy: "worker-promptops",
        status: "PENDING",
        approvedBy: null,
        notes: "Propuesta de nuevo prompt para el agente de onboarding. Mejora la tasa de activación en 15% según A/B test simulado.",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date(Date.now() - 900000).toISOString(),
        resolvedAt: null,
      },
    ],
    _count: { eventLogs: 6 },
  },
];

const EVENTS = {
  "mission-001": [
    { id: "evt-001", missionId: "mission-001", taskId: null, eventType: "MISSION_CREATED", payload: { missionId: "mission-001", title: "Mejorar rendimiento del checkout" }, createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: "evt-002", missionId: "mission-001", taskId: null, eventType: "MISSION_PLANNING", payload: { missionId: "mission-001" }, createdAt: new Date(Date.now() - 3600000 * 1.95).toISOString() },
    { id: "evt-003", missionId: "mission-001", taskId: null, eventType: "PLAN_GENERATED", payload: { missionId: "mission-001", taskCount: 2 }, createdAt: new Date(Date.now() - 3600000 * 1.9).toISOString() },
    { id: "evt-004", missionId: "mission-001", taskId: null, eventType: "MISSION_DISPATCHING", payload: { missionId: "mission-001" }, createdAt: new Date(Date.now() - 3600000 * 1.85).toISOString() },
    { id: "evt-005", missionId: "mission-001", taskId: "task-001", eventType: "TASK_ENQUEUED", payload: { taskId: "task-001", agentType: "RESEARCH" }, createdAt: new Date(Date.now() - 3600000 * 1.8).toISOString() },
    { id: "evt-006", missionId: "mission-001", taskId: "task-001", eventType: "TASK_STARTED", payload: { taskId: "task-001" }, createdAt: new Date(Date.now() - 3600000 * 1.75).toISOString() },
    { id: "evt-007", missionId: "mission-001", taskId: "task-001", eventType: "TASK_COMPLETED", payload: { taskId: "task-001", tokensUsed: 4231, durationMs: 8420 }, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "evt-008", missionId: "mission-001", taskId: "task-001", eventType: "ARTIFACT_CREATED", payload: { artifactId: "artifact-001", artifactType: "DOCUMENT" }, createdAt: new Date(Date.now() - 3600000).toISOString() },
  ],
  "mission-002": [
    { id: "evt-009", missionId: "mission-002", taskId: null, eventType: "MISSION_CREATED", payload: { missionId: "mission-002" }, createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: "evt-010", missionId: "mission-002", taskId: null, eventType: "PLAN_GENERATED", payload: { missionId: "mission-002", taskCount: 2 }, createdAt: new Date(Date.now() - 1700000).toISOString() },
    { id: "evt-011", missionId: "mission-002", taskId: "task-003", eventType: "TASK_COMPLETED", payload: { taskId: "task-003", tokensUsed: 3100 }, createdAt: new Date(Date.now() - 900000).toISOString() },
    { id: "evt-012", missionId: "mission-002", taskId: "task-004", eventType: "TASK_STARTED", payload: { taskId: "task-004" }, createdAt: new Date(Date.now() - 60000).toISOString() },
  ],
  "mission-003": [
    { id: "evt-013", missionId: "mission-003", taskId: null, eventType: "MISSION_CREATED", payload: { missionId: "mission-003" }, createdAt: new Date(Date.now() - 300000).toISOString() },
  ],
};

const TASK_RUNS = {
  "task-001": [
    {
      id: "run-001",
      taskId: "task-001",
      workerName: "worker-research",
      inputPayload: { taskId: "task-001", agentType: "RESEARCH" },
      outputPayload: {
        summary: "Encontrados 3 bottlenecks principales en el checkout",
        findings: [
          { area: "Database", finding: "Queries N+1 en carga de productos del carrito", recommendation: "Usar eager loading con include para cargar productos en una sola query" },
          { area: "Frontend", finding: "Imágenes de productos sin lazy loading ni optimización", recommendation: "Implementar next/image con lazy loading y WebP format" },
          { area: "Bundle", finding: "Bundle size de 2.3MB, incluye librerías no usadas en checkout", recommendation: "Code splitting y tree shaking para reducir bundle a <500KB" }
        ],
        risks: ["Cambios en queries pueden afectar otras partes del sistema", "Migración de imágenes requiere CDN configurado"],
        nextSteps: ["Implementar eager loading en CartService", "Migrar imágenes a next/image", "Auditar imports innecesarios"]
      },
      startedAt: new Date(Date.now() - 3600000 * 1.75).toISOString(),
      finishedAt: new Date(Date.now() - 3600000).toISOString(),
      status: "completed",
      errorMessage: null,
      durationMs: 8420,
      tokensUsed: 4231,
      costUsd: "0.012693",
    }
  ],
  "task-002": [
    {
      id: "run-002",
      taskId: "task-002",
      workerName: "worker-frontend",
      inputPayload: { taskId: "task-002", agentType: "FRONTEND" },
      outputPayload: {
        summary: "Propuesta de optimización frontend con lazy loading y code splitting",
        changes: [
          { file: "components/checkout/CartItem.tsx", change: "Reemplazar <img> con <Image> de next/image" },
          { file: "pages/checkout/index.tsx", change: "Agregar dynamic import para PaymentForm" },
        ]
      },
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      finishedAt: new Date(Date.now() - 1500000).toISOString(),
      status: "completed",
      errorMessage: null,
      durationMs: 12300,
      tokensUsed: 6842,
      costUsd: "0.020526",
    }
  ],
};

const APPROVALS = [
  {
    id: "approval-001",
    missionId: "mission-004",
    taskId: "task-005",
    actionType: "DEPLOY_PROMPT_UPDATE",
    requestedBy: "worker-promptops",
    status: "PENDING",
    approvedBy: null,
    notes: "Propuesta de nuevo prompt para el agente de onboarding. Mejora la tasa de activación en 15% según A/B test simulado.",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 900000).toISOString(),
    resolvedAt: null,
    mission: { title: "Revisar prompts del agente de onboarding" },
  },
];

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
