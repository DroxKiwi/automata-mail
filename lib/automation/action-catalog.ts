import type { RuleActionType } from "@prisma/client";

/**
 * Catalogue « mécanique » des types d’action : métadonnées pour UI, doc et extensions futures.
 * Le moteur réel est dans `lib/inbound/rule-runner.ts` + validation dans `lib/rules-payload.ts`.
 */
export type AutomationActionCatalogEntry = {
  type: RuleActionType;
  label: string;
  shortLabel: string;
  description: string;
  /** Groupe d’affichage dans les formulaires */
  group: "sortie" | "boite" | "contenu";
  /** Exécutée aujourd’hui par le worker / inbound */
  implemented: boolean;
};

export const AUTOMATION_ACTION_CATALOG: AutomationActionCatalogEntry[] = [
  {
    type: "FORWARD",
    label: "Transférer (redirection)",
    shortLabel: "Transfert",
    description:
      "Envoie le message (éventuellement modifié par les actions précédentes) vers une autre boîte.",
    group: "sortie",
    implemented: true,
  },
  {
    type: "AUTO_REPLY",
    label: "Réponse automatique",
    shortLabel: "Réponse auto",
    description:
      "Envoie un e-mail à l’expéditeur (sujet et corps configurables). Utilise la même chaîne d’envoi que les transferts.",
    group: "sortie",
    implemented: true,
  },
  {
    type: "DROP",
    label: "Arrêter / ne pas transmettre",
    shortLabel: "Stop",
    description:
      "Interrompt la chaîne pour ce message (pas de suite logique « sortante » classique après).",
    group: "sortie",
    implemented: true,
  },
  {
    type: "ARCHIVE",
    label: "Archiver dans l’app",
    shortLabel: "Archive",
    description: "Marque le message comme traité et archivé (visible dans l’onglet Traité).",
    group: "boite",
    implemented: true,
  },
  {
    type: "REWRITE_SUBJECT",
    label: "Modifier le sujet",
    shortLabel: "Sujet",
    description: "Préfixe ou remplace le sujet avant les actions suivantes.",
    group: "contenu",
    implemented: true,
  },
  {
    type: "PREPEND_TEXT",
    label: "Préfixer le corps",
    shortLabel: "Corps",
    description: "Ajoute du texte en tête du corps du message.",
    group: "contenu",
    implemented: true,
  },
];

const BY_TYPE = new Map(
  AUTOMATION_ACTION_CATALOG.map((e) => [e.type, e])
);

export function getAutomationActionMeta(
  type: RuleActionType
): AutomationActionCatalogEntry | undefined {
  return BY_TYPE.get(type);
}

/** Types proposés dans les sélecteurs d’automatisations (ordre catalogue). */
export const AUTOMATION_ACTION_TYPES_ORDER: RuleActionType[] =
  AUTOMATION_ACTION_CATALOG.map((e) => e.type);
