"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutomationEditor } from "@/components/automation/automation-editor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type RuleSummaryListItem = {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  stopProcessing: boolean;
  inboundAddress: { localPart: string; domain: string } | null;
  _count: { conditions: number; actions: number };
  automationId: number | null;
};

type FilterOption = { id: number; name: string };

type RulesSummaryCardProps = {
  rules: RuleSummaryListItem[];
  emphasis: "conditions" | "actions";
  /** Onglet Automate : liste des filtres pour l’éditeur inline. */
  filters?: FilterOption[];
};

export function RulesSummaryCard({ rules, emphasis, filters }: RulesSummaryCardProps) {
  const router = useRouter();
  const [deletingAutomationId, setDeletingAutomationId] = useState<number | null>(null);
  const [expandedAutomationId, setExpandedAutomationId] = useState<number | null>(null);

  const title =
    emphasis === "conditions" ? "Filtres enregistrés" : "Automatisations enregistrées";
  const description =
    emphasis === "conditions"
      ? "Rappel : priorité plus petite = évaluée en premier. Les actions se gèrent dans l’onglet Automate."
      : "Rappel : priorité plus petite = évaluée en premier. Les critères se définissent dans l’onglet Filtres. Clique sur Modifier pour éditer sur place.";

  async function deleteAutomation(automationId: number, name: string) {
    if (
      !window.confirm(
        `Supprimer l’automatisation « ${name} » ? La règle exécutée par le moteur sera supprimée aussi.`,
      )
    ) {
      return;
    }
    setDeletingAutomationId(automationId);
    try {
      const res = await fetch(`/api/automations/${automationId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "Suppression impossible.");
        return;
      }
      if (expandedAutomationId === automationId) {
        setExpandedAutomationId(null);
      }
      router.refresh();
    } finally {
      setDeletingAutomationId(null);
    }
  }

  function toggleExpand(automationId: number) {
    setExpandedAutomationId((cur) => (cur === automationId ? null : automationId));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune règle pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {rules.map((r) => {
              const showAutomationActions =
                emphasis === "actions" && r.automationId != null && filters != null;
              const aid = r.automationId;
              const isExpanded = aid != null && expandedAutomationId === aid;

              return (
                <li
                  key={r.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-border"
                >
                  <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium">
                        {r.name}{" "}
                        <span className="text-muted-foreground">
                          (priorité {r.priority}
                          {r.enabled ? "" : ", désactivée"})
                        </span>
                        {r.automationId != null ? (
                          <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-normal text-primary">
                            Automatisation
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Portée :{" "}
                        {r.inboundAddress
                          ? `${r.inboundAddress.localPart}@${r.inboundAddress.domain}`
                          : "toutes les adresses"}
                        {" · "}
                        {r.stopProcessing
                          ? "arrêt après cette règle"
                          : "les règles suivantes peuvent aussi s’appliquer"}
                      </div>
                      <div
                        className={
                          emphasis === "conditions"
                            ? "text-xs font-medium text-foreground"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {r._count.conditions} condition(s)
                      </div>
                      <div
                        className={
                          emphasis === "actions"
                            ? "text-xs font-medium text-foreground"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {r._count.actions} action(s)
                        {r._count.actions === 0 && emphasis === "conditions" ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {" "}
                            — à compléter dans Automate
                          </span>
                        ) : null}
                        {r._count.actions === 0 && emphasis === "actions" ? (
                          <span className="text-amber-700 dark:text-amber-400">
                            {" "}
                            — ancienne règle sans action ; préfère un filtre + « Automate à partir d’un filtre »
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {showAutomationActions && aid != null ? (
                      <div className="flex shrink-0 flex-row flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={isExpanded ? "secondary" : "outline"}
                          size="sm"
                          disabled={deletingAutomationId === aid}
                          onClick={() => toggleExpand(aid)}
                        >
                          {isExpanded ? "Réduire" : "Modifier"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={deletingAutomationId === aid}
                          onClick={() => deleteAutomation(aid, r.name)}
                        >
                          {deletingAutomationId === aid ? "…" : "Supprimer"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {isExpanded && aid != null && filters != null ? (
                    <AutomationEditor
                      key={aid}
                      variant="inline"
                      automationId={aid}
                      filters={filters}
                      onCancelEdit={() => setExpandedAutomationId(null)}
                      onSaved={() => setExpandedAutomationId(null)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
