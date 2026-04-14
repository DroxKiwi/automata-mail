/** Constantes et types partagés par `FilterEditor` (formulaire filtre). */

export const FIELD_OPTIONS = [
  { value: "FROM", label: "Expéditeur", hint: "Adresse ou extrait de l’expéditeur." },
  { value: "SUBJECT", label: "Sujet", hint: "Champ Subject du message." },
  { value: "BODY", label: "Corps du message", hint: "Texte brut ou HTML simplifié." },
  {
    value: "HEADER",
    label: "En-tête MIME",
    hint: "Ex. List-Unsubscribe — précise le nom exact.",
  },
] as const;

export const OPERATOR_OPTIONS = [
  { value: "CONTAINS", label: "contient" },
  { value: "EQUALS", label: "est égal à" },
  { value: "STARTS_WITH", label: "commence par" },
  { value: "REGEX", label: "expression régulière" },
] as const;

export const QUICK_PRESETS: { label: string; field: string; operator: string }[] = [
  { label: "Sujet contient…", field: "SUBJECT", operator: "CONTAINS" },
  { label: "Expéditeur contient…", field: "FROM", operator: "CONTAINS" },
  { label: "Corps contient…", field: "BODY", operator: "CONTAINS" },
  { label: "En-tête…", field: "HEADER", operator: "CONTAINS" },
];

export type ConditionRow = {
  key: string;
  field: string;
  headerName: string;
  operator: string;
  value: string;
  caseSensitive: boolean;
};

export const INITIAL_CONDITION_KEY = "c-0";

export function newClientRowKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ApiFilterCondition = {
  id: number;
  field: string;
  headerName: string | null;
  operator: string;
  value: string;
  caseSensitive: boolean;
};

export type ApiFilter = {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  inboundAddressId: number | null;
  conditions: ApiFilterCondition[];
};
