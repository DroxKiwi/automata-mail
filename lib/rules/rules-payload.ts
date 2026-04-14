import {
  RuleActionType,
  RuleField,
  RuleOperator,
} from "@prisma/client";

const RULE_FIELDS = new Set(Object.values(RuleField));
const RULE_OPERATORS = new Set(Object.values(RuleOperator));
const ACTION_TYPES = new Set(Object.values(RuleActionType));

export type ConditionInput = {
  field: RuleField;
  headerName?: string | null;
  operator: RuleOperator;
  value: string;
  caseSensitive?: boolean;
};

export type ActionInput = {
  type: RuleActionType;
  order: number;
  config: Record<string, unknown>;
};

export function validateConditions(items: ConditionInput[]): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return "Ajoute au moins une condition.";
  }
  for (const c of items) {
    if (!RULE_FIELDS.has(c.field)) {
      return "Champ de condition invalide.";
    }
    if (!RULE_OPERATORS.has(c.operator)) {
      return "Operateur invalide.";
    }
    if (typeof c.value !== "string") {
      return "Valeur de condition invalide.";
    }
    if (c.field === "HEADER") {
      const name = (c.headerName ?? "").trim();
      if (!name) {
        return "Pour une condition sur un en-tete, indique le nom de l en-tete.";
      }
    }
  }
  return null;
}

export function validateActions(items: ActionInput[]): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return "Ajoute au moins une action.";
  }
  for (const a of items) {
    if (!ACTION_TYPES.has(a.type)) {
      return "Type d action invalide.";
    }
    if (typeof a.order !== "number" || !Number.isFinite(a.order)) {
      return "Ordre d action invalide.";
    }
    const cfg = a.config;
    if (!cfg || typeof cfg !== "object") {
      return "Configuration d action invalide.";
    }
    if (a.type === "FORWARD") {
      const to = typeof cfg.to === "string" ? cfg.to.trim() : "";
      if (!to) {
        return "L action Transfert necessite une adresse e-mail de destination.";
      }
    }
    if (a.type === "REWRITE_SUBJECT") {
      const mode = cfg.mode;
      if (mode === "prefix") {
        const prefix = typeof cfg.prefix === "string" ? cfg.prefix : "";
        if (!prefix.trim()) {
          return "Le prefixe de sujet est requis.";
        }
      } else if (mode === "replace") {
        const subject = typeof cfg.subject === "string" ? cfg.subject : "";
        if (!subject.trim()) {
          return "Le nouveau sujet est requis.";
        }
      } else {
        return "Mode de reecriture de sujet invalide (prefix ou replace).";
      }
    }
    if (a.type === "PREPEND_TEXT") {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      if (!text.trim()) {
        return "Le texte a ajouter au corps est requis.";
      }
    }
    if (a.type === "ARCHIVE") {
      /* config libre, souvent {} */
    }
    if (a.type === "AUTO_REPLY") {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      const html = typeof cfg.html === "string" ? cfg.html : "";
      if (!text.trim() && !html.trim()) {
        return "La reponse automatique requiert un corps texte ou HTML.";
      }
    }
  }
  return null;
}
