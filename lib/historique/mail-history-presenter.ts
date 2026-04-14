import type { MailFlowEvent, Prisma } from "@prisma/client";

export type MailHistoryCategory =
  | "reception"
  | "transfert"
  | "traitement"
  | "synchro"
  | "redaction"
  | "alerte"
  | "erreur";

export type MailHistoryRow = {
  id: number;
  at: Date;
  category: MailHistoryCategory;
  /** Titre court pour l’utilisateur */
  title: string;
  /** Détail (souvent le résumé technique déjà en français) */
  description: string;
  actorKey: string;
  actorLabel: string;
  correlationId: string;
  step: string;
  inboundMessageId?: number;
  detail: unknown;
};

/** Étapes internes masquées dans la vue client (doublon du résultat suivant). */
const HIDDEN_STEPS = new Set(["smtp_outbound_attempt", "auto_reply_attempt"]);

function extractInboundMessageId(detail: unknown): number | undefined {
  if (!detail || typeof detail !== "object") {
    return undefined;
  }
  const raw = (detail as { inboundMessageId?: unknown }).inboundMessageId;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  return undefined;
}

type StepPresentation = {
  category: MailHistoryCategory;
  title: string;
};

/** Étapes connues pour filtrer en base (hors étapes masquées à l’affichage). */
const STEP_PRESENTATION: Record<string, StepPresentation> = {
  api_inbound_received: {
    category: "reception",
    title: "Courriel reçu par la passerelle",
  },
  api_inbound_mime_error: {
    category: "erreur",
    title: "Impossible d\u2019analyser le message",
  },
  api_inbound_process_error: {
    category: "erreur",
    title: "Erreur lors du traitement",
  },
  api_inbound_no_recipient: {
    category: "alerte",
    title: "Destinataire non reconnu",
  },
  inbound_message_stored: {
    category: "reception",
    title: "Message enregistré en boîte",
  },
  smtp_outbound_sent: {
    category: "transfert",
    title: "Transfert ou envoi réussi",
  },
  smtp_outbound_failed: {
    category: "erreur",
    title: "Échec du transfert ou de l’envoi",
  },
  gmail_inbox_imported: {
    category: "synchro",
    title: "Message importé depuis Gmail",
  },
  outlook_inbox_imported: {
    category: "synchro",
    title: "Message importé depuis Outlook",
  },
  gmail_delivery_failure_reconciled: {
    category: "alerte",
    title: "Échec de livraison détecté (rebond)",
  },
  rule_message_dropped: {
    category: "traitement",
    title: "Message écarté par une règle",
  },
  rule_message_archived: {
    category: "traitement",
    title: "Message archivé par une règle",
  },
  rule_auto_reply_sent: {
    category: "traitement",
    title: "Réponse automatique envoyée",
  },
  ui_message_archived_manual: {
    category: "traitement",
    title: "Message archivé manuellement",
  },
  ui_transfer_shortcut_sent: {
    category: "transfert",
    title: "Transfert manuel (raccourci)",
  },
  ui_transfer_shortcut_failed: {
    category: "erreur",
    title: "Échec du transfert manuel",
  },
  ui_compose_sent: {
    category: "redaction",
    title: "Message envoyé depuis la boîte",
  },
  ui_compose_failed: {
    category: "erreur",
    title: "Échec d’envoi depuis la boîte",
  },
};

function defaultPresentation(step: string): StepPresentation {
  return {
    category: "alerte",
    title: step.replace(/_/g, " "),
  };
}

export function actorToClientLabel(actor: string): string {
  if (actor === "smtp-gateway") {
    return "Passerelle SMTP";
  }
  if (actor === "next") {
    return "Application";
  }
  return actor;
}

/**
 * Transforme un événement brut en ligne d’historique client (ou null si masqué).
 */
export function presentMailFlowEvent(ev: MailFlowEvent): MailHistoryRow | null {
  if (HIDDEN_STEPS.has(ev.step)) {
    return null;
  }
  const pres = STEP_PRESENTATION[ev.step] ?? defaultPresentation(ev.step);
  const inboundMessageId = extractInboundMessageId(ev.detail);

  return {
    id: ev.id,
    at: ev.createdAt,
    category: pres.category,
    title: pres.title,
    description: ev.summary,
    actorKey: ev.actor,
    actorLabel: actorToClientLabel(ev.actor),
    correlationId: ev.correlationId,
    step: ev.step,
    inboundMessageId,
    detail: ev.detail,
  };
}

/** Étapes masquées côté liste client (à exclure des requêtes Prisma alignées sur la présentation). */
export const MAIL_HISTORY_EXCLUDED_STEPS = [
  "smtp_outbound_attempt",
  "auto_reply_attempt",
] as const;

export type MailHistoryListCategory = MailHistoryCategory | "all";

const STEPS_BY_CATEGORY: Record<MailHistoryCategory, string[]> = (() => {
  const acc: Record<MailHistoryCategory, string[]> = {
    reception: [],
    transfert: [],
    traitement: [],
    synchro: [],
    redaction: [],
    alerte: [],
    erreur: [],
  };
  for (const [step, pres] of Object.entries(STEP_PRESENTATION)) {
    acc[pres.category].push(step);
  }
  return acc;
})();

/**
 * Filtre Prisma pour l’historique : exclut les étapes internes ; restreint à une catégorie si besoin.
 */
export function mailHistoryPrismaWhere(
  category: MailHistoryListCategory,
  automationId?: number | null,
): Prisma.MailFlowEventWhereInput {
  const and: Prisma.MailFlowEventWhereInput[] = [
    { step: { notIn: [...MAIL_HISTORY_EXCLUDED_STEPS] } },
  ];
  if (category !== "all") {
    const steps = STEPS_BY_CATEGORY[category];
    if (steps.length > 0) {
      and.push({ step: { in: steps } });
    }
  }
  if (automationId != null && Number.isFinite(automationId) && automationId > 0) {
    and.push({
      detail: {
        path: ["automationId"],
        equals: automationId,
      },
    });
  }
  return { AND: and };
}

export function presentMailFlowEvents(events: MailFlowEvent[]): MailHistoryRow[] {
  const rows: MailHistoryRow[] = [];
  for (const ev of events) {
    const row = presentMailFlowEvent(ev);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}
