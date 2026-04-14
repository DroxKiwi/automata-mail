/**
 * Couche « mécanique » des automatisations (hors UI).
 *
 * - `action-catalog` : métadonnées des types d’action (labels, groupes, extension future).
 * - `merge-filters-for-rule` : fusion des conditions de plusieurs filtres + contrainte de portée.
 * - `sync-materialized-rule` : persistance + règle Prisma exécutée par `rule-runner`.
 */

export {
  AUTOMATION_ACTION_CATALOG,
  AUTOMATION_ACTION_TYPES_ORDER,
  getAutomationActionMeta,
  type AutomationActionCatalogEntry,
} from "./action-catalog";
export { MergeFiltersError, buildMergedConditionsFromFilterIds } from "./merge-filters-for-rule";
export {
  createAutomationWithMaterializedRule,
  dedupeFilterIdsPreserveOrder,
  deleteAutomationCascade,
  updateAutomationWithMaterializedRule,
} from "./sync-materialized-rule";
