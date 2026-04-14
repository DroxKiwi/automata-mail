"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import {
  defaultRuleActionRow,
  RuleActionsEditor,
  ruleActionRowsToPayload,
  type RuleActionRow,
} from "@/components/rules/rule-actions-editor";

type AddressOption = { id: number; localPart: string; domain: string };

const RULE_FIELDS = [
  { value: "FROM", label: "Expediteur (From)", hint: "Adresse ou partie de l expediteur." },
  { value: "SUBJECT", label: "Sujet", hint: "Champ Subject du mail." },
  { value: "BODY", label: "Corps (texte)", hint: "Corps texte brut si disponible apres parsing." },
  {
    value: "HEADER",
    label: "En-tete MIME",
    hint: "Ex. List-Unsubscribe, X-Custom-Id. Precise le nom exact de l en-tete.",
  },
] as const;

const OPERATORS = [
  { value: "CONTAINS", label: "contient" },
  { value: "EQUALS", label: "est egal a" },
  { value: "STARTS_WITH", label: "commence par" },
  { value: "REGEX", label: "correspond a (regex)" },
] as const;

type ConditionRow = {
  key: string;
  field: string;
  headerName: string;
  operator: string;
  value: string;
  caseSensitive: boolean;
};

/** Cles pour nouvelles lignes : uniquement depuis des handlers client (pas dans l etat initial SSR). */
function newRowKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function RuleForm({
  addresses,
  variant = "full",
}: {
  addresses: AddressOption[];
  /** `filters` : uniquement critères + portée (actions vides, à compléter dans Automate). */
  variant?: "filters" | "full";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [stopProcessing, setStopProcessing] = useState(true);
  const [inboundAddressId, setInboundAddressId] = useState<string>("__all__");

  const [conditions, setConditions] = useState<ConditionRow[]>([
    {
      key: "condition-default",
      field: "SUBJECT",
      headerName: "",
      operator: "CONTAINS",
      value: "",
      caseSensitive: false,
    },
  ]);

  const [actions, setActions] = useState<RuleActionRow[]>(() =>
    variant === "filters" ? [] : [defaultRuleActionRow()],
  );

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const addressLabel = useMemo(
    () => (a: AddressOption) => `${a.localPart}@${a.domain}`,
    []
  );

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      {
        key: newRowKey("condition"),
        field: "SUBJECT",
        headerName: "",
        operator: "CONTAINS",
        value: "",
        caseSensitive: false,
      },
    ]);
  }

  function removeCondition(key: string) {
    setConditions((prev) =>
      prev.length <= 1 ? prev : prev.filter((c) => c.key !== key)
    );
  }

  function updateCondition(key: string, patch: Partial<ConditionRow>) {
    setConditions((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  }

  function buildPayload() {
    const condPayload = conditions.map((c) => ({
      field: c.field,
      headerName: c.field === "HEADER" ? c.headerName : null,
      operator: c.operator,
      value: c.value,
      caseSensitive: c.caseSensitive,
    }));

    const actPayload =
      variant === "filters" ? [] : ruleActionRowsToPayload(actions);

    return {
      name: name.trim(),
      enabled,
      priority,
      stopProcessing,
      inboundAddressId:
        inboundAddressId === "__all__" ? null : Number(inboundAddressId),
      conditions: condPayload,
      actions: actPayload,
      ...(variant === "filters" ? { allowEmptyActions: true as const } : {}),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erreur serveur.");
        return;
      }
      setMessage(`Regle enregistree (id ${(data as { rule?: { id: number } }).rule?.id}).`);
      setName("");
      setConditions([
        {
          key: "condition-default",
          field: "SUBJECT",
          headerName: "",
          operator: "CONTAINS",
          value: "",
          caseSensitive: false,
        },
      ]);
      if (variant === "full") {
        setActions([defaultRuleActionRow()]);
      }
      router.refresh();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>
            {variant === "filters"
              ? "Définir un filtre d’entrée"
              : "Comment fonctionne une règle ?"}
          </CardTitle>
          <CardDescription>
            {variant === "filters" ? (
              <>
                Tu définis <strong>quand</strong> un message correspond : toutes les conditions
                ci-dessous doivent être vraies (ET logique). La règle est enregistrée{" "}
                <strong>sans action</strong> pour l’instant ; ajoute transferts, sujet, etc. dans
                l’onglet <strong>Automate</strong>.
              </>
            ) : (
              <>
                Une règle dit : <strong>si toutes les conditions</strong> ci-dessous sont vraies
                (logique ET), alors on exécute <strong>les actions</strong> dans l&apos;ordre
                indiqué. Si tu coches &quot;Arrêter après cette règle&quot;, les règles suivantes
                (priorité plus basse) ne seront pas évaluées.
              </>
            )}
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
          <CardTitle>{variant === "filters" ? "Portée et priorité" : "En-tête de la règle"}</CardTitle>
          <CardDescription>
            Portée : une adresse d&apos;entrée précise, ou toutes tes adresses si tu laisses
            &quot;Toutes&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-name">Nom du filtre / de la règle</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Factures vers compta"
              required
              disabled={pending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Adresse d&apos;entree</Label>
              <Select
                value={inboundAddressId}
                onValueChange={setInboundAddressId}
                disabled={pending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Toutes les adresses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes les adresses</SelectItem>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {addressLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si tu choisis une adresse, la regle ne s&apos;applique qu&apos;aux mails
                recus sur <code className="rounded bg-muted px-1">local@domain</code> de
                cette ligne.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priorite (nombre)</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Plus le nombre est <strong>petit</strong>, plus la regle est evaluee{" "}
                <strong>tot</strong> (convention du moteur).
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enabled"
                checked={enabled}
                onCheckedChange={(v) => setEnabled(v === true)}
                disabled={pending}
              />
              <Label htmlFor="enabled" className="font-normal">
                Regle active
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stop"
                checked={stopProcessing}
                onCheckedChange={(v) => setStopProcessing(v === true)}
                disabled={pending}
              />
              <Label htmlFor="stop" className="font-normal">
                Arreter apres cette regle (ne pas evaluer les suivantes)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Conditions (ET logique)</CardTitle>
              <CardDescription>
                {variant === "filters"
                  ? "Toutes les lignes doivent être vraies pour que ce filtre s’applique au message."
                  : "Toutes les lignes doivent être vraies pour déclencher les actions."}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCondition}>
              Ajouter une condition
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {conditions.map((c, index) => (
            <div key={c.key}>
              {index > 0 ? <Separator className="mb-6" /> : null}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
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
                    <Label>Champ teste</Label>
                    <Select
                      value={c.field}
                      onValueChange={(v) => updateCondition(c.key, { field: v })}
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {
                        RULE_FIELDS.find((f) => f.value === c.field)?.hint
                      }
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Operateur</Label>
                    <Select
                      value={c.operator}
                      onValueChange={(v) => updateCondition(c.key, { operator: v })}
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => (
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
                    <Label htmlFor={`hn-${c.key}`}>Nom de l&apos;en-tete</Label>
                    <Input
                      id={`hn-${c.key}`}
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
                  <Label htmlFor={`cv-${c.key}`}>Valeur / motif</Label>
                  <Input
                    id={`cv-${c.key}`}
                    value={c.value}
                    onChange={(e) => updateCondition(c.key, { value: e.target.value })}
                    placeholder={
                      c.operator === "REGEX"
                        ? "^facture-[0-9]+"
                        : "Texte a comparer"
                    }
                    disabled={pending}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`cs-${c.key}`}
                    checked={c.caseSensitive}
                    onCheckedChange={(v) =>
                      updateCondition(c.key, { caseSensitive: v === true })
                    }
                    disabled={pending}
                  />
                  <Label htmlFor={`cs-${c.key}`} className="font-normal">
                    Sensible a la casse
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {variant === "full" ? (
        <RuleActionsEditor
          actions={actions}
          onActionsChange={setActions}
          disabled={pending}
        />
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending
          ? "Enregistrement…"
          : variant === "filters"
            ? "Enregistrer le filtre"
            : "Enregistrer la règle"}
      </Button>
    </form>
  );
}
