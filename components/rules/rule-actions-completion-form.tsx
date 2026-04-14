"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultRuleActionRow,
  RuleActionsEditor,
  ruleActionRowsToPayload,
  type RuleActionRow,
} from "@/components/rules/rule-actions-editor";
import { cn } from "@/lib/utils";

type FilterOption = { id: number; name: string };

type ApiCondition = {
  field: string;
  operator: string;
  value: string;
  headerName?: string | null;
  caseSensitive?: boolean;
};

type ApiFilter = {
  id: number;
  name: string;
  conditions: ApiCondition[];
};

function conditionSummary(c: ApiCondition): string {
  const h = c.headerName?.trim()
    ? ` (en-tête « ${c.headerName.trim()} »)`
    : "";
  const cs = c.caseSensitive ? " · casse exacte" : "";
  return `${c.field} ${c.operator} « ${c.value} »${h}${cs}`;
}

type RuleActionsCompletionFormProps = {
  /** Filtres enregistrés (onglet Filtres). */
  filters: FilterOption[];
};

/**
 * Crée une règle complète : conditions copiées depuis le filtre choisi + actions saisies ici.
 */
export function RuleActionsCompletionForm({ filters }: RuleActionsCompletionFormProps) {
  const router = useRouter();
  const [filterId, setFilterId] = useState<string>("");
  const [filterName, setFilterName] = useState("");
  const [conditionsLines, setConditionsLines] = useState<string[]>([]);
  const [ruleNameOverride, setRuleNameOverride] = useState("");
  const [actions, setActions] = useState<RuleActionRow[]>([defaultRuleActionRow()]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!filterId) {
      setFilterName("");
      setConditionsLines([]);
      setRuleNameOverride("");
      setActions([defaultRuleActionRow()]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/filters/${filterId}`);
        const data = (await res.json()) as { filter?: ApiFilter; error?: string };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "Chargement impossible.");
          setConditionsLines([]);
          return;
        }
        const filter = data.filter;
        if (!filter) {
          setError("Réponse invalide.");
          return;
        }
        setFilterName(filter.name);
        setConditionsLines(filter.conditions.map(conditionSummary));
        setActions([defaultRuleActionRow()]);
      } catch {
        if (!cancelled) {
          setError("Erreur réseau.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filterId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filterId) {
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        filterId: Number(filterId),
        actions: ruleActionRowsToPayload(actions),
      };
      const trimmed = ruleNameOverride.trim();
      if (trimmed) {
        body.name = trimmed;
      }
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        rule?: { id: number; name: string };
      };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage(
        `Règle « ${data.rule?.name ?? ""} » créée (#${data.rule?.id}). Les conditions proviennent du filtre sélectionné.`,
      );
      setFilterId("");
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automate à partir d’un filtre</CardTitle>
        <CardDescription>
          Choisis un filtre enregistré dans l’onglet <strong>Filtres</strong>, puis définis les
          actions (transfert, etc.). Une <strong>nouvelle règle</strong> est créée avec les mêmes
          conditions que le filtre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun filtre enregistré. Crée d’abord un filtre dans l’onglet Filtres.
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="completion-filter">Filtre source</Label>
              <select
                id="completion-filter"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                disabled={pending}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <option value="">— Choisir un filtre —</option>
                {filters.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name} (#{f.id})
                  </option>
                ))}
              </select>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                {message}
              </div>
            ) : null}

            {filterId ? (
              <>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Chargement du filtre…</p>
                ) : (
                  <>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
                      <p className="font-medium text-foreground">{filterName}</p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">Conditions</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {conditionsLines.length === 0 ? (
                          <li>(aucune condition)</li>
                        ) : (
                          conditionsLines.map((line, i) => <li key={i}>{line}</li>)
                        )}
                      </ul>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="rule-name-override">Nom de la règle (optionnel)</Label>
                      <Input
                        id="rule-name-override"
                        value={ruleNameOverride}
                        onChange={(e) => setRuleNameOverride(e.target.value)}
                        placeholder={`Par défaut : « ${filterName} »`}
                        disabled={pending}
                      />
                      <p className="text-xs text-muted-foreground">
                        Si tu laisses vide, la règle portera le même nom que le filtre.
                      </p>
                    </div>

                    <RuleActionsEditor
                      actions={actions}
                      onActionsChange={setActions}
                      disabled={pending}
                    />

                    <Button type="submit" disabled={pending || loading}>
                      {pending ? "Création…" : "Créer la règle avec ces actions"}
                    </Button>
                  </>
                )}
              </>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
