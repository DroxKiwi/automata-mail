"use client";

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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const ACTION_TYPES = [
  {
    value: "FORWARD",
    label: "Transfert",
    hint: "Envoie une copie (ou le message modifie) vers une autre adresse.",
  },
  {
    value: "REWRITE_SUBJECT",
    label: "Reecrire le sujet",
    hint: "Ajoute un prefixe ou remplace tout le sujet avant les actions suivantes.",
  },
  {
    value: "PREPEND_TEXT",
    label: "Prefixer le corps",
    hint: "Ajoute du texte au debut du corps (texte brut).",
  },
  {
    value: "DROP",
    label: "Abandonner",
    hint: "Ne pas transmettre le message (apres eventuelles modifs en memoire).",
  },
] as const;

export type RuleActionRow = {
  key: string;
  type: string;
  order: number;
  forwardTo: string;
  subjectMode: "prefix" | "replace";
  subjectPrefix: string;
  subjectReplace: string;
  prependText: string;
};

function newRowKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultRuleActionRow(): RuleActionRow {
  return {
    key: "action-0",
    type: "FORWARD",
    order: 1,
    forwardTo: "",
    subjectMode: "prefix",
    subjectPrefix: "",
    subjectReplace: "",
    prependText: "",
  };
}

export function ruleActionRowsToPayload(actions: RuleActionRow[]) {
  return actions.map((a) => {
    let config: Record<string, unknown> = {};
    if (a.type === "FORWARD") {
      config = { to: a.forwardTo.trim() };
    } else if (a.type === "REWRITE_SUBJECT") {
      if (a.subjectMode === "prefix") {
        config = { mode: "prefix", prefix: a.subjectPrefix };
      } else {
        config = { mode: "replace", subject: a.subjectReplace };
      }
    } else if (a.type === "PREPEND_TEXT") {
      config = { text: a.prependText };
    } else if (a.type === "DROP") {
      config = {};
    }
    return { type: a.type, order: a.order, config };
  });
}

type ApiAction = { id: number; type: string; order: number; config: unknown };

export function dbActionsToRuleActionRows(list: ApiAction[]): RuleActionRow[] {
  if (!list.length) {
    return [defaultRuleActionRow()];
  }
  return list.map((a) => {
    const cfg = (a.config ?? {}) as Record<string, unknown>;
    const row: RuleActionRow = {
      key: `db-${a.id}`,
      type: a.type,
      order: a.order,
      forwardTo: "",
      subjectMode: "prefix",
      subjectPrefix: "",
      subjectReplace: "",
      prependText: "",
    };
    if (a.type === "FORWARD") {
      row.forwardTo = String(cfg.to ?? "");
    }
    if (a.type === "REWRITE_SUBJECT") {
      if (cfg.mode === "replace") {
        row.subjectMode = "replace";
        row.subjectReplace = String(cfg.subject ?? "");
      } else {
        row.subjectMode = "prefix";
        row.subjectPrefix = String(cfg.prefix ?? "");
      }
    }
    if (a.type === "PREPEND_TEXT") {
      row.prependText = String(cfg.text ?? "");
    }
    return row;
  });
}

type RuleActionsEditorProps = {
  actions: RuleActionRow[];
  onActionsChange: (rows: RuleActionRow[]) => void;
  disabled?: boolean;
};

export function RuleActionsEditor({
  actions,
  onActionsChange,
  disabled = false,
}: RuleActionsEditorProps) {
  function addAction() {
    onActionsChange([
      ...actions,
      {
        ...defaultRuleActionRow(),
        key: newRowKey("action"),
        order: actions.length + 1,
      },
    ]);
  }

  function removeAction(key: string) {
    if (actions.length <= 1) {
      return;
    }
    onActionsChange(actions.filter((a) => a.key !== key));
  }

  function updateAction(key: string, patch: Partial<RuleActionRow>) {
    onActionsChange(actions.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Actions (ordre d&apos;exécution)</CardTitle>
            <CardDescription>
              Exécutées dans l&apos;ordre croissant du champ &quot;Ordre&quot;. Les modifications
              (sujet, corps) s&apos;appliquent en mémoire avant un éventuel transfert.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addAction} disabled={disabled}>
            Ajouter une action
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {actions.map((a, index) => (
          <div key={a.key}>
            {index > 0 ? <Separator className="mb-6" /> : null}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Action {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeAction(a.key)}
                  disabled={disabled || actions.length <= 1}
                >
                  Retirer
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Type</Label>
                  <Select
                    value={a.type}
                    onValueChange={(v) => updateAction(a.key, { type: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {ACTION_TYPES.find((t) => t.value === a.type)?.hint}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`ord-${a.key}`}>Ordre</Label>
                  <Input
                    id={`ord-${a.key}`}
                    type="number"
                    min={1}
                    value={a.order}
                    onChange={(e) =>
                      updateAction(a.key, { order: Number(e.target.value) })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>

              {a.type === "FORWARD" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`ft-${a.key}`}>Transfert vers (e-mail)</Label>
                  <Input
                    id={`ft-${a.key}`}
                    type="email"
                    value={a.forwardTo}
                    onChange={(e) =>
                      updateAction(a.key, { forwardTo: e.target.value })
                    }
                    placeholder="compta@entreprise.com"
                    disabled={disabled}
                  />
                </div>
              ) : null}

              {a.type === "REWRITE_SUBJECT" ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Mode</Label>
                    <Select
                      value={a.subjectMode}
                      onValueChange={(v) =>
                        updateAction(a.key, {
                          subjectMode: v as "prefix" | "replace",
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefix">Prefixer le sujet</SelectItem>
                        <SelectItem value="replace">Remplacer tout le sujet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {a.subjectMode === "prefix" ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`sp-${a.key}`}>Prefixe</Label>
                      <Input
                        id={`sp-${a.key}`}
                        value={a.subjectPrefix}
                        onChange={(e) =>
                          updateAction(a.key, { subjectPrefix: e.target.value })
                        }
                        placeholder="[FACTURE] "
                        disabled={disabled}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`sr-${a.key}`}>Nouveau sujet</Label>
                      <Input
                        id={`sr-${a.key}`}
                        value={a.subjectReplace}
                        onChange={(e) =>
                          updateAction(a.key, { subjectReplace: e.target.value })
                        }
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {a.type === "PREPEND_TEXT" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`pt-${a.key}`}>Texte a ajouter en tete du corps</Label>
                  <Textarea
                    id={`pt-${a.key}`}
                    value={a.prependText}
                    onChange={(e) =>
                      updateAction(a.key, { prependText: e.target.value })
                    }
                    rows={4}
                    disabled={disabled}
                  />
                </div>
              ) : null}

              {a.type === "DROP" ? (
                <p className="text-sm text-muted-foreground">
                  Aucun champ supplementaire : le message ne sera pas transmis apres cette action.
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
