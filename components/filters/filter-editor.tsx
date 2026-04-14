"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiFilter,
  ConditionRow,
  FIELD_OPTIONS,
  INITIAL_CONDITION_KEY,
  newClientRowKey,
  OPERATOR_OPTIONS,
  QUICK_PRESETS,
} from "@/components/filters/filter-editor-model";
import { cn } from "@/lib/utils";

type AddressOption = { id: number; localPart: string; domain: string };

export type FilterEditorProps = {
  addresses: AddressOption[];
  /** Création : carte pleine page. Édition : formulaire compact dans la liste. */
  variant?: "page" | "inline";
  /** Uniquement si `variant="inline"` : id du filtre à modifier. */
  filterId?: number | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
};

export function FilterEditor({
  addresses,
  variant = "page",
  filterId = null,
  onCancelEdit,
  onSaved,
}: FilterEditorProps) {
  const router = useRouter();
  const isInline = variant === "inline";
  const isEdit = isInline && filterId != null && filterId > 0;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [inboundAddressId, setInboundAddressId] = useState<string>("__all__");
  const [conditions, setConditions] = useState<ConditionRow[]>([
    {
      key: INITIAL_CONDITION_KEY,
      field: "SUBJECT",
      headerName: "",
      operator: "CONTAINS",
      value: "",
      caseSensitive: false,
    },
  ]);
  const [pending, setPending] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(() => isEdit);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const idPrefix = isInline && filterId ? `f-${filterId}` : "filter-new";

  useEffect(() => {
    if (!isEdit) {
      setName("");
      setDescription("");
      setEnabled(true);
      setPriority(100);
      setInboundAddressId("__all__");
      setConditions([
        {
          key: INITIAL_CONDITION_KEY,
          field: "SUBJECT",
          headerName: "",
          operator: "CONTAINS",
          value: "",
          caseSensitive: false,
        },
      ]);
      setLoadingEdit(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoadingEdit(true);
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
          return;
        }
        const f = data.filter;
        if (!f) {
          setError("Réponse invalide.");
          return;
        }
        setName(f.name);
        setDescription(f.description ?? "");
        setEnabled(f.enabled);
        setPriority(f.priority);
        setInboundAddressId(
          f.inboundAddressId == null ? "__all__" : String(f.inboundAddressId),
        );
        const rows: ConditionRow[] =
          f.conditions.length > 0
            ? f.conditions.map((c) => ({
                key: `fc-${c.id}`,
                field: c.field,
                headerName: c.headerName ?? "",
                operator: c.operator,
                value: c.value,
                caseSensitive: c.caseSensitive,
              }))
            : [
                {
                  key: INITIAL_CONDITION_KEY,
                  field: "SUBJECT",
                  headerName: "",
                  operator: "CONTAINS",
                  value: "",
                  caseSensitive: false,
                },
              ];
        setConditions(rows);
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
  }, [filterId, isEdit]);

  const addressLabel = useMemo(
    () => (id: string) => {
      if (id === "__all__") {
        return "Toutes les adresses d’entrée";
      }
      const a = addresses.find((x) => String(x.id) === id);
      return a ? `${a.localPart}@${a.domain}` : id;
    },
    [addresses],
  );

  function addPreset(field: string, operator: string) {
    setConditions((prev) => [
      ...prev,
      {
        key: newClientRowKey("c"),
        field,
        headerName: "",
        operator,
        value: "",
        caseSensitive: false,
      },
    ]);
  }

  function updateCondition(key: string, patch: Partial<ConditionRow>) {
    setConditions((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    );
  }

  function removeCondition(key: string) {
    setConditions((prev) =>
      prev.length <= 1 ? prev : prev.filter((c) => c.key !== key),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        enabled,
        priority,
        inboundAddressId:
          inboundAddressId === "__all__" ? null : Number(inboundAddressId),
        conditions: conditions.map((c) => ({
          field: c.field,
          headerName: c.field === "HEADER" ? c.headerName : null,
          operator: c.operator,
          value: c.value,
          caseSensitive: c.caseSensitive,
        })),
      };
      const url = isEdit ? `/api/filters/${filterId}` : "/api/filters";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; filter?: { id: number } };
      if (!res.ok) {
        setError(data.error ?? "Erreur serveur.");
        return;
      }
      setMessage(
        isEdit
          ? "Mis à jour. Si une automatisation l’utilise, rouvre-la dans Automate et enregistre pour resynchroniser."
          : `Filtre enregistré (#${data.filter?.id}). Tu peux l’utiliser dans Automate.`,
      );
      if (!isEdit) {
        setName("");
        setDescription("");
        setConditions([
          {
            key: INITIAL_CONDITION_KEY,
            field: "SUBJECT",
            headerName: "",
            operator: "CONTAINS",
            value: "",
            caseSensitive: false,
          },
        ]);
        setPriority(100);
        setEnabled(true);
        setInboundAddressId("__all__");
      }
      onSaved?.();
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setPending(false);
    }
  }

  const labelClass = isInline ? "text-xs font-medium" : undefined;
  const fieldGap = isInline ? "gap-1.5" : "gap-2";
  const sectionGap = isInline ? "space-y-3" : "space-y-4";
  const condBox = isInline
    ? "rounded-md border border-border bg-background/80 p-2.5 space-y-2.5"
    : "rounded-lg border border-border bg-muted/20 p-4 space-y-4";

  const formInner = (
    <>
      {error ? (
        <div
          role="alert"
          className={cn(
            "rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-destructive",
            isInline ? "text-xs" : "px-3 py-2 text-sm",
          )}
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          className={cn(
            "rounded-md border border-border bg-muted/40",
            isInline ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
          )}
        >
          {message}
        </div>
      ) : null}

      {isEdit && loadingEdit ? (
        <p className={cn("text-muted-foreground", isInline ? "text-xs" : "text-sm")}>
          Chargement du filtre…
        </p>
      ) : null}

      {!(isEdit && loadingEdit) ? (
        <>
          <div className={cn("flex flex-col", fieldGap)}>
            <Label htmlFor={`${idPrefix}-name`} className={labelClass}>
              Nom
            </Label>
            <Input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Factures fournisseur"
              disabled={pending}
              required
              className={isInline ? "h-8 text-sm" : undefined}
            />
          </div>
          <div className={cn("flex flex-col", fieldGap)}>
            <Label htmlFor={`${idPrefix}-desc`} className={labelClass}>
              Note (optionnelle)
            </Label>
            <Textarea
              id={`${idPrefix}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rappel…"
              rows={isInline ? 2 : 2}
              disabled={pending}
              className={cn("resize-y min-h-[3rem]", isInline && "text-sm min-h-[2.75rem]")}
            />
          </div>

          <div className={cn(sectionGap, "pt-1")}>
            <p className={cn("font-medium text-muted-foreground", isInline ? "text-xs" : "text-sm")}>
              Conditions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  className={isInline ? "h-7 text-xs" : undefined}
                  onClick={() => addPreset(p.field, p.operator)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {!isInline ? <Separator /> : <div className="border-t border-border" />}

            {conditions.map((c, index) => (
              <div key={c.key} className={condBox}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-medium text-muted-foreground",
                      isInline ? "text-xs" : "text-sm",
                    )}
                  >
                    Condition {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("text-destructive", isInline && "h-7 text-xs")}
                    onClick={() => removeCondition(c.key)}
                    disabled={pending || conditions.length <= 1}
                  >
                    Retirer
                  </Button>
                </div>

                <div className={cn("grid gap-2", !isInline && "sm:grid-cols-2 sm:gap-4")}>
                  <div className={cn("flex flex-col", fieldGap)}>
                    <Label className={labelClass}>Champ</Label>
                    <Select
                      value={c.field}
                      onValueChange={(v) => updateCondition(c.key, { field: v })}
                      disabled={pending}
                    >
                      <SelectTrigger className={isInline ? "h-8 text-sm" : undefined}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isInline ? (
                      <p className="text-xs text-muted-foreground">
                        {FIELD_OPTIONS.find((f) => f.value === c.field)?.hint}
                      </p>
                    ) : null}
                  </div>

                  <div className={cn("flex flex-col", fieldGap)}>
                    <Label className={labelClass}>Opérateur</Label>
                    <Select
                      value={c.operator}
                      onValueChange={(v) => updateCondition(c.key, { operator: v })}
                      disabled={pending}
                    >
                      <SelectTrigger className={isInline ? "h-8 text-sm" : undefined}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {c.field === "HEADER" ? (
                  <div className={cn("flex flex-col", fieldGap)}>
                    <Label htmlFor={`${idPrefix}-hn-${c.key}`} className={labelClass}>
                      En-tête
                    </Label>
                    <Input
                      id={`${idPrefix}-hn-${c.key}`}
                      value={c.headerName}
                      onChange={(e) =>
                        updateCondition(c.key, { headerName: e.target.value })
                      }
                      placeholder="List-Unsubscribe"
                      disabled={pending}
                      className={isInline ? "h-8 text-sm" : undefined}
                    />
                  </div>
                ) : null}

                <div className={cn("flex flex-col", fieldGap)}>
                  <Label htmlFor={`${idPrefix}-cv-${c.key}`} className={labelClass}>
                    Texte
                  </Label>
                  <Input
                    id={`${idPrefix}-cv-${c.key}`}
                    value={c.value}
                    onChange={(e) => updateCondition(c.key, { value: e.target.value })}
                    placeholder={
                      c.operator === "REGEX"
                        ? "^facture-[0-9]+"
                        : "Ex. no-reply@…"
                    }
                    disabled={pending}
                    className={isInline ? "h-8 text-sm" : undefined}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${idPrefix}-cs-${c.key}`}
                    checked={c.caseSensitive}
                    onCheckedChange={(v) =>
                      updateCondition(c.key, { caseSensitive: v === true })
                    }
                    disabled={pending}
                  />
                  <Label
                    htmlFor={`${idPrefix}-cs-${c.key}`}
                    className={cn("font-normal", isInline ? "text-xs" : "text-sm")}
                  >
                    Casse
                  </Label>
                </div>
              </div>
            ))}
          </div>

          <details
            className={cn(
              "rounded-md border border-border bg-card",
              isInline && "text-sm",
            )}
          >
            <summary
              className={cn(
                "cursor-pointer select-none font-medium",
                isInline ? "px-2.5 py-2 text-xs" : "px-4 py-3 text-sm",
              )}
            >
              Portée, priorité, actif
            </summary>
            <div
              className={cn(
                "space-y-3 border-t border-border",
                isInline ? "px-2.5 py-2" : "px-4 py-4 space-y-4",
              )}
            >
              <div className={cn("flex flex-col", fieldGap)}>
                <Label htmlFor={`${idPrefix}-scope`} className={labelClass}>
                  Adresse d’entrée
                </Label>
                <Select
                  value={inboundAddressId}
                  onValueChange={setInboundAddressId}
                  disabled={pending}
                >
                  <SelectTrigger id={`${idPrefix}-scope`} className={isInline ? "h-8 text-sm" : undefined}>
                    <SelectValue placeholder="Portée" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{addressLabel("__all__")}</SelectItem>
                    {addresses.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {addressLabel(String(a.id))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={cn("flex flex-col", fieldGap)}>
                <Label htmlFor={`${idPrefix}-prio`} className={labelClass}>
                  Priorité
                </Label>
                <Input
                  id={`${idPrefix}-prio`}
                  type="number"
                  min={0}
                  max={1_000_000}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 0)}
                  disabled={pending}
                  className={isInline ? "h-8 text-sm" : undefined}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-1.5">
                <Label htmlFor={`${idPrefix}-en`} className={cn(labelClass, "font-normal")}>
                  Filtre actif
                </Label>
                <Switch
                  id={`${idPrefix}-en`}
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  disabled={pending}
                />
              </div>
            </div>
          </details>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="submit"
              disabled={pending}
              size={isInline ? "sm" : "default"}
              className={isInline ? "h-8" : undefined}
            >
              {pending
                ? "…"
                : isEdit
                  ? "Enregistrer"
                  : "Enregistrer le filtre"}
            </Button>
            {isEdit && onCancelEdit ? (
              <Button
                type="button"
                variant="outline"
                size={isInline ? "sm" : "default"}
                className={isInline ? "h-8" : undefined}
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
    </>
  );

  if (isInline) {
    return (
      <div className="border-t border-border bg-muted/30 px-3 py-3">
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {formInner}
        </form>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau filtre</CardTitle>
          <CardDescription>
            Un filtre décrit <strong>quels messages</strong> correspondent à un motif (toutes les
            conditions ci-dessous doivent être vraies). Tu pourras ensuite brancher des actions dans
            l’onglet <strong>Automate</strong>.
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
          <CardDescription>Nom visible dans la liste et dans Automate.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-name`}>Nom du filtre</Label>
            <Input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Factures fournisseur"
              disabled={pending}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-desc`}>Note (optionnelle)</Label>
            <Textarea
              id={`${idPrefix}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rappel pour toi : ce que ce filtre cible…"
              rows={2}
              disabled={pending}
              className="resize-y min-h-[4rem]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conditions</CardTitle>
          <CardDescription>
            Raccourcis pour ajouter une ligne — tu peux ensuite affiner le texte et l’opérateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => addPreset(p.field, p.operator)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <Separator />

          {conditions.map((c, index) => (
            <div
              key={c.key}
              className="rounded-lg border border-border bg-muted/20 p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Condition {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeCondition(c.key)}
                  disabled={pending || conditions.length <= 1}
                >
                  Retirer
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Champ</Label>
                  <Select
                    value={c.field}
                    onValueChange={(v) => updateCondition(c.key, { field: v })}
                    disabled={pending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {FIELD_OPTIONS.find((f) => f.value === c.field)?.hint}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Opérateur</Label>
                  <Select
                    value={c.operator}
                    onValueChange={(v) => updateCondition(c.key, { operator: v })}
                    disabled={pending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {c.field === "HEADER" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${idPrefix}-hn-${c.key}`}>Nom de l’en-tête</Label>
                  <Input
                    id={`${idPrefix}-hn-${c.key}`}
                    value={c.headerName}
                    onChange={(e) =>
                      updateCondition(c.key, { headerName: e.target.value })
                    }
                    placeholder="List-Unsubscribe"
                    disabled={pending}
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${idPrefix}-cv-${c.key}`}>Texte à comparer</Label>
                <Input
                  id={`${idPrefix}-cv-${c.key}`}
                  value={c.value}
                  onChange={(e) => updateCondition(c.key, { value: e.target.value })}
                  placeholder={
                    c.operator === "REGEX"
                      ? "^facture-[0-9]+"
                      : "Ex. no-reply@entreprise.com"
                  }
                  disabled={pending}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-cs-${c.key}`}
                  checked={c.caseSensitive}
                  onCheckedChange={(v) =>
                    updateCondition(c.key, { caseSensitive: v === true })
                  }
                  disabled={pending}
                />
                <Label htmlFor={`${idPrefix}-cs-${c.key}`} className="font-normal text-sm">
                  Sensible à la casse
                </Label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Portée et priorité (avancé)
        </summary>
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-scope`}>Adresse d’entrée</Label>
            <Select
              value={inboundAddressId}
              onValueChange={setInboundAddressId}
              disabled={pending}
            >
              <SelectTrigger id={`${idPrefix}-scope`}>
                <SelectValue placeholder="Portée" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{addressLabel("__all__")}</SelectItem>
                {addresses.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {addressLabel(String(a.id))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Limite ce filtre à une adresse précise, ou laisse « Toutes » pour tout le trafic
              entrant concerné.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-prio`}>Priorité (nombre plus petit = évalué avant)</Label>
            <Input
              id={`${idPrefix}-prio`}
              type="number"
              min={0}
              max={1_000_000}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
              disabled={pending}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor={`${idPrefix}-en`} className="text-sm">
                Filtre actif
              </Label>
              <p className="text-xs text-muted-foreground">
                Désactivé : le filtre reste en base ; les automatisations existantes gardent une copie
                des conditions jusqu’à leur prochain enregistrement.
              </p>
            </div>
            <Switch
              id={`${idPrefix}-en`}
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={pending}
            />
          </div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Enregistrement…" : "Enregistrer le filtre"}
        </Button>
      </div>
    </form>
  );
}
