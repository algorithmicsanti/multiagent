import { DEFAULT_ACTORS } from "@wm/agent-core";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

function toJsonValue(value: Record<string, unknown> | undefined) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

export async function syncDefaultActors(prisma: PrismaClient): Promise<void> {
  for (const actor of DEFAULT_ACTORS) {
    await prisma.actor.upsert({
      where: { id: actor.id },
      create: {
        id: actor.id,
        key: actor.key,
        displayName: actor.displayName,
        kind: actor.kind,
        role: actor.role,
        context: actor.context,
        supportedAgentTypes: actor.supportedAgentTypes,
        runtimeAgentType: actor.runtimeAgentType ?? null,
        canBeAssignedDirectly: actor.canBeAssignedDirectly,
        canReceiveDelegation: actor.canReceiveDelegation,
        priority: actor.priority,
        metadata: toJsonValue(actor.metadata),
      },
      update: {
        key: actor.key,
        displayName: actor.displayName,
        kind: actor.kind,
        role: actor.role,
        context: actor.context,
        supportedAgentTypes: actor.supportedAgentTypes,
        runtimeAgentType: actor.runtimeAgentType ?? null,
        canBeAssignedDirectly: actor.canBeAssignedDirectly,
        canReceiveDelegation: actor.canReceiveDelegation,
        priority: actor.priority,
        metadata: toJsonValue(actor.metadata),
        active: true,
      },
    });
  }
}
