import { ActorKind, AgentType } from "./enums.js";

export interface ActorProfile {
  id: string;
  key: string;
  displayName: string;
  kind: ActorKind;
  role: string;
  context: string;
  supportedAgentTypes: AgentType[];
  runtimeAgentType?: AgentType | null;
  canBeAssignedDirectly: boolean;
  canReceiveDelegation: boolean;
  priority: number;
  metadata?: Record<string, unknown>;
}

export interface ActorSnapshot {
  id: string;
  key: string;
  displayName: string;
  kind: ActorKind;
  role: string;
  context: string;
  supportedAgentTypes: AgentType[];
  runtimeAgentType?: AgentType | null;
}

export const CENTRAL_ORCHESTRATOR_ID = "system-central-orchestrator";
export const DEFAULT_HUMAN_ACTOR_IDS = [
  "human-nicholas",
  "human-kevin",
  "human-santiago",
  "human-german",
] as const;

export const DEFAULT_ACTORS: ActorProfile[] = [
  {
    id: CENTRAL_ORCHESTRATOR_ID,
    key: "central-orchestrator",
    displayName: "Central Orchestrator",
    kind: ActorKind.SYSTEM,
    role: "Delegador central de tareas y selector de mejor ejecutor",
    context:
      "Evalua la naturaleza de la tarea, el contexto acumulado de la mision y las fortalezas de humanos/agentes antes de delegar. No ejecuta trabajo manual final; coordina la mejor asignacion.",
    supportedAgentTypes: [
      AgentType.RESEARCH,
      AgentType.FRONTEND,
      AgentType.BACKEND,
      AgentType.DEVOPS,
      AgentType.PROMPTOPS,
    ],
    runtimeAgentType: null,
    canBeAssignedDirectly: true,
    canReceiveDelegation: false,
    priority: 100,
    metadata: {
      label: "delegate",
    },
  },
  {
    id: "human-nicholas",
    key: "nicholas",
    displayName: "Nicholas",
    kind: ActorKind.HUMAN,
    role: "Research strategist y sintetizador de descubrimientos",
    context:
      "Perfil inicial por defecto. Nicholas destaca en discovery, framing de problema, investigacion comparativa y conversion de hallazgos en recomendaciones accionables.",
    supportedAgentTypes: [AgentType.RESEARCH, AgentType.PROMPTOPS, AgentType.FRONTEND],
    runtimeAgentType: null,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 82,
  },
  {
    id: "human-kevin",
    key: "kevin",
    displayName: "Kevin",
    kind: ActorKind.HUMAN,
    role: "Backend builder e integrador de sistemas",
    context:
      "Perfil inicial por defecto. Kevin encaja mejor en API design, integraciones, bases de datos, automatizaciones y tareas donde la consistencia tecnica importa mas que la presentacion.",
    supportedAgentTypes: [AgentType.BACKEND, AgentType.DEVOPS, AgentType.PROMPTOPS],
    runtimeAgentType: null,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 88,
  },
  {
    id: "human-santiago",
    key: "santiago",
    displayName: "Santiago",
    kind: ActorKind.HUMAN,
    role: "Systems lead de orquestacion, operacion e infraestructura",
    context:
      "Perfil inicial por defecto. Santiago es fuerte en arquitectura del sistema, operaciones, debugging cross-service, despliegues y decisiones donde hay tradeoffs de plataforma.",
    supportedAgentTypes: [AgentType.DEVOPS, AgentType.BACKEND, AgentType.PROMPTOPS],
    runtimeAgentType: null,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 90,
  },
  {
    id: "human-german",
    key: "german",
    displayName: "Germán",
    kind: ActorKind.HUMAN,
    role: "Product lead de vision, UX y direccion transversal",
    context:
      "Perfil inicial por defecto. Germán aporta criterio de producto, prioridades, UX, experiencia final y alineacion entre negocio, frontend y coordinacion general.",
    supportedAgentTypes: [AgentType.FRONTEND, AgentType.RESEARCH, AgentType.PROMPTOPS],
    runtimeAgentType: null,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 86,
  },
  {
    id: "agent-research-core",
    key: "research-core",
    displayName: "Research Agent",
    kind: ActorKind.AGENT,
    role: "Agente automatico de investigacion y analisis",
    context:
      "Ejecutor automatico para discovery, documentacion, comparativas, riesgos y synthesis estructurada.",
    supportedAgentTypes: [AgentType.RESEARCH],
    runtimeAgentType: AgentType.RESEARCH,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 85,
  },
  {
    id: "agent-promptops-core",
    key: "promptops-core",
    displayName: "PromptOps Agent",
    kind: ActorKind.AGENT,
    role: "Agente automatico de optimizacion y synthesis ejecutiva",
    context:
      "Ejecutor automatico para optimizacion de plan, handoffs, consolidacion de contexto y tareas especializadas absorbidas por el runtime disponible.",
    supportedAgentTypes: [AgentType.PROMPTOPS, AgentType.FRONTEND, AgentType.BACKEND, AgentType.DEVOPS],
    runtimeAgentType: AgentType.PROMPTOPS,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 84,
  },
  {
    id: "agent-frontend-specialist",
    key: "frontend-specialist",
    displayName: "Frontend Specialist Agent",
    kind: ActorKind.AGENT,
    role: "Especialista de frontend apoyado por PromptOps",
    context:
      "Perfil de agente para tareas de UI, experiencia, componentes y refactors frontend. Mientras no exista worker dedicado, se ejecuta sobre PromptOps sin perder el contexto de frontend.",
    supportedAgentTypes: [AgentType.FRONTEND],
    runtimeAgentType: AgentType.PROMPTOPS,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 78,
  },
  {
    id: "agent-backend-specialist",
    key: "backend-specialist",
    displayName: "Backend Specialist Agent",
    kind: ActorKind.AGENT,
    role: "Especialista de backend apoyado por PromptOps",
    context:
      "Perfil de agente para APIs, contratos, persistencia e integraciones. Mientras no exista worker dedicado, se ejecuta sobre PromptOps preservando el enfoque backend.",
    supportedAgentTypes: [AgentType.BACKEND],
    runtimeAgentType: AgentType.PROMPTOPS,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 79,
  },
  {
    id: "agent-devops-specialist",
    key: "devops-specialist",
    displayName: "DevOps Specialist Agent",
    kind: ActorKind.AGENT,
    role: "Especialista de infraestructura apoyado por PromptOps",
    context:
      "Perfil de agente para despliegue, contenedores, observabilidad y operaciones. Mientras no exista worker dedicado, se ejecuta sobre PromptOps conservando criterio de plataforma.",
    supportedAgentTypes: [AgentType.DEVOPS],
    runtimeAgentType: AgentType.PROMPTOPS,
    canBeAssignedDirectly: true,
    canReceiveDelegation: true,
    priority: 80,
  },
];

export const DEFAULT_DIRECT_ACTOR_BY_AGENT_TYPE: Record<AgentType, string> = {
  [AgentType.ORCHESTRATOR]: CENTRAL_ORCHESTRATOR_ID,
  [AgentType.RESEARCH]: "agent-research-core",
  [AgentType.FRONTEND]: "agent-frontend-specialist",
  [AgentType.BACKEND]: "agent-backend-specialist",
  [AgentType.DEVOPS]: "agent-devops-specialist",
  [AgentType.PROMPTOPS]: "agent-promptops-core",
};

export function getDefaultActorProfile(actorId: string): ActorProfile | undefined {
  return DEFAULT_ACTORS.find((actor) => actor.id === actorId);
}

export function getDefaultActorForAgentType(agentType: AgentType): ActorProfile | undefined {
  const actorId = DEFAULT_DIRECT_ACTOR_BY_AGENT_TYPE[agentType];
  return actorId ? getDefaultActorProfile(actorId) : undefined;
}

export function actorProfileToSnapshot(
  actor: Pick<
    ActorProfile,
    "id" | "key" | "displayName" | "kind" | "role" | "context" | "supportedAgentTypes" | "runtimeAgentType"
  >
): ActorSnapshot {
  return {
    id: actor.id,
    key: actor.key,
    displayName: actor.displayName,
    kind: actor.kind,
    role: actor.role,
    context: actor.context,
    supportedAgentTypes: [...actor.supportedAgentTypes],
    runtimeAgentType: actor.runtimeAgentType ?? null,
  };
}
