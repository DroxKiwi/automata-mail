import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActionInput } from "@/lib/rules/rules-payload";
import { buildMergedConditionsFromFilterIds } from "@/lib/automation/merge-filters-for-rule";

/** Garde l’ordre, supprime les doublons. */
export function dedupeFilterIdsPreserveOrder(filterIds: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of filterIds) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export async function createAutomationWithMaterializedRule(input: {
  userId: number;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  stopProcessing: boolean;
  filterIds: number[];
  actions: ActionInput[];
}): Promise<{ automationId: number; ruleId: number }> {
  const filterIds = dedupeFilterIdsPreserveOrder(input.filterIds);
  const merged = await buildMergedConditionsFromFilterIds(input.userId, filterIds);
  const actionCreates = input.actions.map((a) => ({
    type: a.type,
    order: a.order,
    config: a.config as Prisma.InputJsonValue,
  }));

  return prisma.$transaction(async (tx) => {
    const automation = await tx.automation.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        priority: input.priority,
        stopProcessing: input.stopProcessing,
        filterLinks: {
          create: filterIds.map((filterId, sortOrder) => ({
            filterId,
            sortOrder,
          })),
        },
      },
    });

    const rule = await tx.rule.create({
      data: {
        userId: input.userId,
        automationId: automation.id,
        name: input.name,
        enabled: input.enabled,
        priority: input.priority,
        stopProcessing: input.stopProcessing,
        inboundAddressId: merged.inboundAddressId,
        conditions: { create: merged.conditionCreates },
        actions: { create: actionCreates },
      },
      select: { id: true },
    });

    return { automationId: automation.id, ruleId: rule.id };
  });
}

export async function updateAutomationWithMaterializedRule(
  userId: number,
  automationId: number,
  input: {
    name: string;
    description: string | null;
    enabled: boolean;
    priority: number;
    stopProcessing: boolean;
    filterIds: number[];
    actions: ActionInput[];
  }
): Promise<{ ruleId: number }> {
  const filterIds = dedupeFilterIdsPreserveOrder(input.filterIds);
  const merged = await buildMergedConditionsFromFilterIds(userId, filterIds);
  const actionCreates = input.actions.map((a) => ({
    type: a.type,
    order: a.order,
    config: a.config as Prisma.InputJsonValue,
  }));

  return prisma.$transaction(async (tx) => {
    const automation = await tx.automation.findFirst({
      where: { id: automationId, userId },
      select: { id: true },
    });
    if (!automation) {
      throw new Error("Automatisation introuvable.");
    }

    await tx.automation.update({
      where: { id: automationId },
      data: {
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        priority: input.priority,
        stopProcessing: input.stopProcessing,
      },
    });

    await tx.automationOnFilter.deleteMany({ where: { automationId } });
    await tx.automationOnFilter.createMany({
      data: filterIds.map((filterId, sortOrder) => ({
        automationId,
        filterId,
        sortOrder,
      })),
    });

    const rule = await tx.rule.findFirst({
      where: { automationId, userId },
      select: { id: true },
    });
    if (!rule) {
      throw new Error("Règle matérialisée manquante.");
    }

    await tx.ruleCondition.deleteMany({ where: { ruleId: rule.id } });
    await tx.ruleAction.deleteMany({ where: { ruleId: rule.id } });

    await tx.rule.update({
      where: { id: rule.id },
      data: {
        name: input.name,
        enabled: input.enabled,
        priority: input.priority,
        stopProcessing: input.stopProcessing,
        inboundAddressId: merged.inboundAddressId,
        conditions: { create: merged.conditionCreates },
        actions: { create: actionCreates },
      },
    });

    return { ruleId: rule.id };
  });
}

export async function deleteAutomationCascade(userId: number, automationId: number): Promise<void> {
  const deleted = await prisma.automation.deleteMany({
    where: { id: automationId, userId },
  });
  if (deleted.count === 0) {
    throw new Error("Automatisation introuvable.");
  }
}
