import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class MergeFiltersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeFiltersError";
  }
}

/**
 * Fusionne les conditions de plusieurs filtres (ordre = ordre des IDs, puis sortOrder interne).
 * Tous les filtres doivent avoir la même portée d’adresse d’entrée (toutes ou une même adresse).
 */
export async function buildMergedConditionsFromFilterIds(
  userId: number,
  filterIds: number[]
): Promise<{
  inboundAddressId: number | null;
  conditionCreates: Prisma.RuleConditionCreateWithoutRuleInput[];
}> {
  if (!filterIds.length) {
    throw new MergeFiltersError("Ajoute au moins un filtre.");
  }

  const filters = await prisma.filter.findMany({
    where: { userId, id: { in: filterIds } },
    include: { conditions: { orderBy: { sortOrder: "asc" } } },
  });

  if (filters.length !== filterIds.length) {
    throw new MergeFiltersError("Un filtre est introuvable.");
  }

  const byId = new Map(filters.map((f) => [f.id, f]));
  const ordered = filterIds.map((id) => {
    const f = byId.get(id);
    if (!f) {
      throw new MergeFiltersError("Un filtre est introuvable.");
    }
    return f;
  });

  const scopeKeys = new Set(
    ordered.map((f) =>
      f.inboundAddressId == null ? "__all__" : String(f.inboundAddressId)
    )
  );
  if (scopeKeys.size > 1) {
    throw new MergeFiltersError(
      "Tous les filtres doivent partager la même portée (toutes les adresses ou la même adresse d’entrée)."
    );
  }

  const inboundAddressId = ordered[0].inboundAddressId ?? null;
  const conditionCreates: Prisma.RuleConditionCreateWithoutRuleInput[] = [];

  for (const f of ordered) {
    for (const c of f.conditions) {
      conditionCreates.push({
        field: c.field,
        headerName: c.headerName,
        operator: c.operator,
        value: c.value,
        caseSensitive: c.caseSensitive,
      });
    }
  }

  if (!conditionCreates.length) {
    throw new MergeFiltersError(
      "Les filtres choisis n’ont aucune condition : complète-les dans l’onglet Filtres."
    );
  }

  return { inboundAddressId, conditionCreates };
}
