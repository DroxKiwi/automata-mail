"use client";

import type { RuleActionType } from "@prisma/client";
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
import { AUTOMATION_ACTION_CATALOG } from "@/lib/automation/action-catalog";
import type { ActionInput } from "@/lib/rules/rules-payload";
import { cn } from "@/lib/utils";

export type AutomationActionRow = {
  key: string;
  type: string;
  order: number;
  forwardTo: string;
  subjectMode: "prefix" | "replace";
  subjectPrefix: string;
  subjectReplace: string;
  prependText: string;
  autoReplySubject: string;
  autoReplyText: string;
  autoReplyHtml: string;
};

function newClientRowKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultAutomationActionRow(): AutomationActionRow {
  return {
    key: "action-0",
    type: "FORWARD",
    order: 1,
    forwardTo: "",
    subjectMode: "prefix",
    subjectPrefix: "",
    subjectReplace: "",
    prependText: "",
    autoReplySubject: "",
    autoReplyText: "",
    autoReplyHtml: "",
  };
}

type ApiAction = { id: number; type: string; order: number; config: unknown };

export function dbActionsToAutomationRows(list: ApiAction[]): AutomationActionRow[] {
  if (!list.length) {
    return [defaultAutomationActionRow()];
  }
  return list.map((a) => {
    const cfg = (a.config ?? {}) as Record<string, unknown>;
    const row: AutomationActionRow = {
      key: `db-${a.id}`,
      type: a.type,
      order: a.order,
      forwardTo: "",
      subjectMode: "prefix",
      subjectPrefix: "",
      subjectReplace: "",
      prependText: "",
      autoReplySubject: "",
      autoReplyText: "",
      autoReplyHtml: "",
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
    if (a.type === "AUTO_REPLY") {
      row.autoReplySubject = String(cfg.subject ?? "");
      row.autoReplyText = String(cfg.text ?? "");
      row.autoReplyHtml = String(cfg.html ?? "");
    }
    return row;
  });
}

export function automationActionRowsToPayload(
  rows: AutomationActionRow[]
): ActionInput[] {
  return rows.map((a) => {
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
    } else if (a.type === "DROP" || a.type === "ARCHIVE") {
      config = {};
    } else if (a.type === "AUTO_REPLY") {
      config = {
        subject: a.autoReplySubject.trim(),
        text: a.autoReplyText,
        html: a.autoReplyHtml,
      };
    }
    return {
      type: a.type as RuleActionType,
      order: a.order,
      config,
    };
  });
}

type AutomationActionsEditorProps = {
  actions: AutomationActionRow[];
  onActionsChange: (rows: AutomationActionRow[]) => void;
  disabled?: boolean;
  /** Formulaire compact (édition inline dans la liste). */
  compact?: boolean;
};

export function AutomationActionsEditor({
  actions,
  onActionsChange,
  disabled = false,
  compact = false,
}: AutomationActionsEditorProps) {
  function addAction() {
    onActionsChange([
      ...actions,
      {
        ...defaultAutomationActionRow(),
        key: newClientRowKey("action"),
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

  function updateAction(key: string, patch: Partial<AutomationActionRow>) {
    onActionsChange(actions.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  return (
    <Card className={cn(compact && "shadow-none")}>
      <CardHeader className={cn(compact && "space-y-2 py-3")}>
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
            compact && "gap-1.5",
          )}
        >
          <div>
            <CardTitle className={cn(compact && "text-sm")}>Sortie — actions</CardTitle>
            {compact ? (
              <p className="text-xs text-muted-foreground">Ordre croissant.</p>
            ) : (
              <CardDescription>
                Exécutées dans l’ordre croissant. Redirection, archivage, réponse auto, mise en forme,
                puis éventuellement arrêt.
              </CardDescription>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(compact && "h-7 text-xs shrink-0")}
            onClick={addAction}
            disabled={disabled}
          >
            {compact ? "Ajouter" : "Ajouter une action"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-col", compact ? "gap-3 py-3 pt-0" : "gap-6")}>
        {actions.map((a, index) => (
          <div key={a.key}>
            {index > 0 ? (
              <Separator className={cn(compact ? "mb-3" : "mb-6")} />
            ) : null}
            <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-medium text-muted-foreground",
                    compact ? "text-xs" : "text-sm",
                  )}
                >
                  Action {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("text-destructive", compact && "h-7 text-xs")}
                  onClick={() => removeAction(a.key)}
                  disabled={disabled || actions.length <= 1}
                >
                  Retirer
                </Button>
              </div>

              <div className={cn("grid gap-4 sm:grid-cols-2", compact && "gap-2")}>
                <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                  <Label className={cn(compact && "text-xs")}>Type</Label>
                  <Select
                    value={a.type}
                    onValueChange={(v) => updateAction(a.key, { type: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger className={cn(compact && "h-8 text-sm")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_ACTION_CATALOG.map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!compact ? (
                    <p className="text-xs text-muted-foreground">
                      {AUTOMATION_ACTION_CATALOG.find((t) => t.type === a.type)?.description}
                    </p>
                  ) : null}
                </div>

                <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                  <Label htmlFor={`ord-${a.key}`} className={cn(compact && "text-xs")}>
                    Ordre
                  </Label>
                  <Input
                    id={`ord-${a.key}`}
                    type="number"
                    min={1}
                    value={a.order}
                    onChange={(e) =>
                      updateAction(a.key, { order: Number(e.target.value) })
                    }
                    disabled={disabled}
                    className={cn(compact && "h-8 text-sm")}
                  />
                </div>
              </div>

              {a.type === "FORWARD" ? (
                <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                  <Label htmlFor={`ft-${a.key}`} className={cn(compact && "text-xs")}>
                    Transférer vers
                  </Label>
                  <Input
                    id={`ft-${a.key}`}
                    type="email"
                    value={a.forwardTo}
                    onChange={(e) =>
                      updateAction(a.key, { forwardTo: e.target.value })
                    }
                    placeholder="compta@entreprise.com"
                    disabled={disabled}
                    className={cn(compact && "h-8 text-sm")}
                  />
                </div>
              ) : null}

              {a.type === "AUTO_REPLY" ? (
                <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
                  <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                    <Label htmlFor={`ars-${a.key}`} className={cn(compact && "text-xs")}>
                      Sujet (optionnel)
                    </Label>
                    <Input
                      id={`ars-${a.key}`}
                      value={a.autoReplySubject}
                      onChange={(e) =>
                        updateAction(a.key, { autoReplySubject: e.target.value })
                      }
                      placeholder="Re: votre message"
                      disabled={disabled}
                      className={cn(compact && "h-8 text-sm")}
                    />
                  </div>
                  <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                    <Label htmlFor={`art-${a.key}`} className={cn(compact && "text-xs")}>
                      Corps texte
                    </Label>
                    <Textarea
                      id={`art-${a.key}`}
                      value={a.autoReplyText}
                      onChange={(e) =>
                        updateAction(a.key, { autoReplyText: e.target.value })
                      }
                      rows={compact ? 2 : 4}
                      disabled={disabled}
                      className={cn(compact && "text-sm min-h-[3rem]")}
                    />
                  </div>
                  <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                    <Label htmlFor={`arh-${a.key}`} className={cn(compact && "text-xs")}>
                      Corps HTML (optionnel)
                    </Label>
                    <Textarea
                      id={`arh-${a.key}`}
                      value={a.autoReplyHtml}
                      onChange={(e) =>
                        updateAction(a.key, { autoReplyHtml: e.target.value })
                      }
                      rows={compact ? 2 : 3}
                      disabled={disabled}
                      className={cn(compact && "text-sm min-h-[2.5rem]")}
                    />
                  </div>
                </div>
              ) : null}

              {a.type === "REWRITE_SUBJECT" ? (
                <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
                  <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                    <Label className={cn(compact && "text-xs")}>Mode</Label>
                    <Select
                      value={a.subjectMode}
                      onValueChange={(v) =>
                        updateAction(a.key, {
                          subjectMode: v as "prefix" | "replace",
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className={cn(compact && "h-8 text-sm")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefix">Préfixer le sujet</SelectItem>
                        <SelectItem value="replace">Remplacer tout le sujet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {a.subjectMode === "prefix" ? (
                    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                      <Label htmlFor={`sp-${a.key}`} className={cn(compact && "text-xs")}>
                        Préfixe
                      </Label>
                      <Input
                        id={`sp-${a.key}`}
                        value={a.subjectPrefix}
                        onChange={(e) =>
                          updateAction(a.key, { subjectPrefix: e.target.value })
                        }
                        placeholder="[FACTURE] "
                        disabled={disabled}
                        className={cn(compact && "h-8 text-sm")}
                      />
                    </div>
                  ) : (
                    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                      <Label htmlFor={`sr-${a.key}`} className={cn(compact && "text-xs")}>
                        Nouveau sujet
                      </Label>
                      <Input
                        id={`sr-${a.key}`}
                        value={a.subjectReplace}
                        onChange={(e) =>
                          updateAction(a.key, { subjectReplace: e.target.value })
                        }
                        disabled={disabled}
                        className={cn(compact && "h-8 text-sm")}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {a.type === "PREPEND_TEXT" ? (
                <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
                  <Label htmlFor={`pt-${a.key}`} className={cn(compact && "text-xs")}>
                    Texte en tête du corps
                  </Label>
                  <Textarea
                    id={`pt-${a.key}`}
                    value={a.prependText}
                    onChange={(e) =>
                      updateAction(a.key, { prependText: e.target.value })
                    }
                    rows={compact ? 2 : 4}
                    disabled={disabled}
                    className={cn(compact && "text-sm min-h-[3rem]")}
                  />
                </div>
              ) : null}

              {a.type === "DROP" ? (
                <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  Arrêt du traitement pour ce message après cette action (selon la position dans la
                  liste).
                </p>
              ) : null}

              {a.type === "ARCHIVE" ? (
                <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                  Le message est marqué comme traité et archivé (onglet Traité).
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
