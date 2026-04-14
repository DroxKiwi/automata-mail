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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AutomationActionsEditor,
  automationActionRowsToPayload,
  dbActionsToAutomationRows,
  defaultAutomationActionRow,
  type AutomationActionRow,
} from "@/components/automation/automation-actions-editor";
import { cn } from "@/lib/utils";

type FilterOption = { id: number; name: string };

type ApiAutomation = {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  stopProcessing: boolean;
  filterLinks: Array<{ filterId: number; sortOrder: number }>;
  rule: {
    actions: Array<{ id: number; type: string; order: number; config: unknown }>;
  } | null;
};

export type AutomationEditorProps = {
  filters: FilterOption[];
  variant?: "page" | "inline";
  /** Uniquement si `variant="inline"`. */
  automationId?: number | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
};

function emptyFormState() {
  return {
    name: "",
    description: "",
    enabled: true,
    priority: 100,
    stopProcessing: true,
    selectedFilterIds: [] as number[],
    actions: [defaultAutomationActionRow()] as AutomationActionRow[],
  };
}

export function AutomationEditor({
  filters,
  variant = "page",
  automationId = null,
  onCancelEdit,
  onSaved,
}: AutomationEditorProps) {
  const router = useRouter();
  const isInline = variant === "inline";
  const isEdit = isInline && automationId != null && automationId > 0;
  const idPrefix = isInline && automationId ? `a-${automationId}` : "auto-new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [stopProcessing, setStopProcessing] = useState(true);
  const [selectedFilterIds, setSelectedFilterIds] = useState<number[]>([]);
  const [pickFilterId, setPickFilterId] = useState<string>("");
  const [actions, setActions] = useState<AutomationActionRow[]>([
    defaultAutomationActionRow(),
  ]);
  const [pending, setPending] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(() => isEdit);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      const empty = emptyFormState();
      setName(empty.name);
      setDescription(empty.description);
      setEnabled(empty.enabled);
      setPriority(empty.priority);
      setStopProcessing(empty.stopProcessing);
      setSelectedFilterIds(empty.selectedFilterIds);
      setActions(empty.actions);
      setLoadingEdit(false);
      return;
    }

    let cancelled = false;
    setLoadingEdit(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/automations/${automationId}`);
        const data = (await res.json()) as {
          automation?: ApiAutomation;
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "Chargement impossible.");
          return;
        }
        const a = data.automation;
        if (!a) {
          setError("Réponse invalide.");
          return;
        }
        setName(a.name);
        setDescription(a.description ?? "");
        setEnabled(a.enabled);
        setPriority(a.priority);
        setStopProcessing(a.stopProcessing);
        const ordered = [...a.filterLinks].sort((x, y) => x.sortOrder - y.sortOrder);
        setSelectedFilterIds(ordered.map((l) => l.filterId));
        setActions(dbActionsToAutomationRows(a.rule?.actions ?? []));
      } catch {
        if (!cancelled) {
          setError("Erreur réseau.");
        }
      } finally {
        if (!cancelled) {
          setLoadingEdit(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [automationId, isEdit]);

  function addPickedFilter() {
    const id = Number.parseInt(pickFilterId, 10);
    if (!Number.isFinite(id) || id < 1) {
      return;
    }
    if (selectedFilterIds.includes(id)) {
      return;
    }
    setSelectedFilterIds((prev) => [...prev, id]);
    setPickFilterId("");
  }

  function removeFilterAt(index: number) {
    setSelectedFilterIds((prev) => prev.filter((_, i) => i !== index));
  }

  function moveFilter(index: number, delta: -1 | 1) {
    setSelectedFilterIds((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (selectedFilterIds.length === 0) {
      setError("Ajoute au moins un filtre.");
      return;
    }
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        enabled,
        priority,
        stopProcessing,
        filterIds: selectedFilterIds,
        actions: automationActionRowsToPayload(actions),
      };
      const url = isEdit ? `/api/automations/${automationId}` : "/api/automations";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage(isEdit ? "Mis à jour." : "Automatisation créée.");
      if (!isEdit) {
        const empty = emptyFormState();
        setName(empty.name);
        setDescription(empty.description);
        setSelectedFilterIds(empty.selectedFilterIds);
        setActions(empty.actions);
        setPriority(empty.priority);
        setStopProcessing(empty.stopProcessing);
        setEnabled(empty.enabled);
      }
      onSaved?.();
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setPending(false);
    }
  }

  const filtersNotInList = filters.filter((f) => !selectedFilterIds.includes(f.id));

  const inlineAlerts = (
    <>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
          {message}
        </div>
      ) : null}
      {loadingEdit ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : null}
    </>
  );

  if (isInline) {
    return (
      <div className="max-h-[min(75vh,880px)] overflow-y-auto border-t border-border bg-muted/30 px-3 py-3">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {inlineAlerts}

          {!loadingEdit ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${idPrefix}-name`} className="text-xs font-medium">
                  Nom
                </Label>
                <Input
                  id={`${idPrefix}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. Factures → compta"
                  disabled={pending}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${idPrefix}-desc`} className="text-xs font-medium">
                  Description
                </Label>
                <Textarea
                  id={`${idPrefix}-desc`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  disabled={pending}
                  className="min-h-[2.75rem] resize-y text-sm"
                />
              </div>

              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground">Filtres (ET)</p>
                {filters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun filtre. Crée-en dans Filtres.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[160px] flex-1">
                        <Select
                          value={pickFilterId}
                          onValueChange={setPickFilterId}
                          disabled={pending || filtersNotInList.length === 0}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Ajouter…" />
                          </SelectTrigger>
                          <SelectContent>
                            {filtersNotInList.map((f) => (
                              <SelectItem key={f.id} value={String(f.id)}>
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={pending || !pickFilterId}
                        onClick={addPickedFilter}
                      >
                        Ajouter
                      </Button>
                    </div>
                    {selectedFilterIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun filtre sélectionné.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5 text-xs">
                        {selectedFilterIds.map((fid, index) => {
                          const meta = filters.find((f) => f.id === fid);
                          return (
                            <li
                              key={`${fid}-${index}`}
                              className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1.5"
                            >
                              <span className="min-w-0 flex-1 font-medium">
                                {index + 1}. {meta?.name ?? `#${fid}`}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={pending || index === 0}
                                onClick={() => moveFilter(index, -1)}
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={pending || index >= selectedFilterIds.length - 1}
                                onClick={() => moveFilter(index, 1)}
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive"
                                disabled={pending}
                                onClick={() => removeFilterAt(index)}
                              >
                                ×
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </div>

              <AutomationActionsEditor
                actions={actions}
                onActionsChange={setActions}
                disabled={pending}
                compact
              />

              <details className="rounded-md border border-border bg-card text-sm">
                <summary className="cursor-pointer select-none px-2.5 py-2 text-xs font-medium">
                  Priorité, actif, arrêt
                </summary>
                <div className="space-y-2 border-t border-border px-2.5 py-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${idPrefix}-prio`} className="text-xs">
                      Priorité
                    </Label>
                    <Input
                      id={`${idPrefix}-prio`}
                      type="number"
                      min={0}
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value) || 0)}
                      disabled={pending}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                    <Label className="text-xs font-normal">Actif</Label>
                    <Switch checked={enabled} onCheckedChange={setEnabled} disabled={pending} />
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                    <Label className="text-xs font-normal">Arrêter après</Label>
                    <Switch
                      checked={stopProcessing}
                      onCheckedChange={setStopProcessing}
                      disabled={pending}
                    />
                  </div>
                </div>
              </details>

              <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                <Button type="submit" size="sm" className="h-8" disabled={pending || loadingEdit}>
                  {pending ? "…" : "Enregistrer"}
                </Button>
                {onCancelEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={pending}
                    onClick={() => {
                      setMessage(null);
                      setError(null);
                      onCancelEdit();
                    }}
                  >
                    Fermer
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle automatisation</CardTitle>
          <CardDescription>
            Entrée : un ou plusieurs <strong>filtres</strong> (tous doivent correspondre — ET entre
            filtres ; chaque filtre garde son propre ET interne). Sortie : enchaînement
            d’<strong>actions</strong> (transfert, archive, réponse auto, etc.).
          </CardDescription>
        </CardHeader>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-name`}>Nom</Label>
            <Input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Factures → compta + archive"
              disabled={pending}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-desc`}>Description (optionnelle)</Label>
            <Textarea
              id={`${idPrefix}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={pending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entrée — filtres</CardTitle>
          <CardDescription>
            Même portée d’adresse pour tous (toutes les adresses ou une adresse précise). Sinon
            l’enregistrement est refusé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {filters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun filtre enregistré. Crée-en dans l’onglet Filtres.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 flex flex-col gap-2">
                  <Label>Ajouter un filtre</Label>
                  <Select
                    value={pickFilterId}
                    onValueChange={setPickFilterId}
                    disabled={pending || filtersNotInList.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtersNotInList.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || !pickFilterId}
                  onClick={addPickedFilter}
                >
                  Ajouter
                </Button>
              </div>

              {selectedFilterIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun filtre sélectionné pour l’instant.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {selectedFilterIds.map((fid, index) => {
                    const meta = filters.find((f) => f.id === fid);
                    return (
                      <li
                        key={`${fid}-${index}`}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 font-medium">
                          {index + 1}. {meta?.name ?? `#${fid}`}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending || index === 0}
                          onClick={() => moveFilter(index, -1)}
                        >
                          Haut
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending || index >= selectedFilterIds.length - 1}
                          onClick={() => moveFilter(index, 1)}
                        >
                          Bas
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={pending}
                          onClick={() => removeFilterAt(index)}
                        >
                          Retirer
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AutomationActionsEditor
        actions={actions}
        onActionsChange={setActions}
        disabled={pending}
      />

      <details className={cn("rounded-lg border border-border bg-card")}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Priorité et comportement (avancé)
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-prio`}>Priorité (plus petit = avant)</Label>
            <Input
              id={`${idPrefix}-prio`}
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
              disabled={pending}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
            <div>
              <Label className="text-sm">Actif</Label>
              <p className="text-xs text-muted-foreground">
                Désactivé : la règle matérialisée ne s’exécute pas.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={pending} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
            <div>
              <Label className="text-sm">Arrêter après cette automatisation</Label>
              <p className="text-xs text-muted-foreground">
                Si coché, les règles / automatisations de priorité plus basse ne sont pas
                évaluées.
              </p>
            </div>
            <Switch
              checked={stopProcessing}
              onCheckedChange={setStopProcessing}
              disabled={pending}
            />
          </div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Créer l’automatisation"}
        </Button>
      </div>
    </form>
  );
}
