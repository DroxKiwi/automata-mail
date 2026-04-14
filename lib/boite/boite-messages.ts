import type { Prisma } from "@prisma/client";
import { ActionLogStatus, RuleActionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type BoiteListMessage = {
  id: number;
  receivedAt: Date;
  /** Non null = lu dans l'interface (ex. ouverture + option Gmail). */
  readAt: Date | null;
  mailFrom: string;
  subject: string | null;
  textBody: string | null;
  rcptTo: Prisma.JsonValue;
  inboundAddress: { localPart: string; domain: string };
  attachments: { id: number }[];
  /** Présent si le message a été importé depuis l’API Gmail (identifiant côté Google). */
  gmailMessageId: string | null;
  /** Présent si le message a été importé depuis Microsoft Graph. */
  outlookMessageId: string | null;
};

/** Transfert réussi : règle FORWARD ou raccourci (journal SENT + type FORWARD). */
const whereHasSuccessfulForward: Prisma.InboundMessageWhereInput = {
  actionLogs: {
    some: {
      status: ActionLogStatus.SENT,
      OR: [
        { action: { type: RuleActionType.FORWARD } },
        {
          actionId: null,
          detail: { path: ["type"], equals: "FORWARD" },
        },
      ],
    },
  },
};

/** Trace affichée dans Traité (inclut archivage manuel dans l’historique). */
const whereHasTreatmentLog: Prisma.InboundMessageWhereInput = {
  actionLogs: {
    some: {
      status: ActionLogStatus.SENT,
      OR: [
        { action: { type: RuleActionType.FORWARD } },
        { detail: { path: ["type"], equals: "FORWARD" } },
        { detail: { path: ["type"], equals: "UI_ARCHIVE" } },
        { detail: { path: ["type"], equals: "ARCHIVE" } },
        { detail: { path: ["type"], equals: "AUTO_REPLY" } },
        { detail: { path: ["type"], equals: "DROP" } },
      ],
    },
  },
};

/**
 * Traitements qui doivent exclure le message de la boîte (hors archivage seul : géré par `archived`).
 * Sans UI_ARCHIVE : après désarchivage, le message peut revenir en réception.
 */
const whereHasInboxBlockingTreatment: Prisma.InboundMessageWhereInput = {
  actionLogs: {
    some: {
      status: ActionLogStatus.SENT,
      OR: [
        { action: { type: RuleActionType.FORWARD } },
        { detail: { path: ["type"], equals: "FORWARD" } },
        { detail: { path: ["type"], equals: "ARCHIVE" } },
        { detail: { path: ["type"], equals: "AUTO_REPLY" } },
        { detail: { path: ["type"], equals: "DROP" } },
      ],
    },
  },
};

const boiteListMessageSelect = {
  id: true,
  receivedAt: true,
  readAt: true,
  mailFrom: true,
  subject: true,
  textBody: true,
  rcptTo: true,
  gmailMessageId: true,
  outlookMessageId: true,
  inboundAddress: {
    select: { localPart: true, domain: true },
  },
  attachments: { select: { id: true }, take: 1 },
} as unknown as Prisma.InboundMessageSelect;

export const BOITE_INBOX_PER_PAGE_OPTIONS = [50, 100, 200] as const;
export type BoiteInboxPerPage = (typeof BOITE_INBOX_PER_PAGE_OPTIONS)[number];

export type BoiteInboxListExtras = {
  /** Si true, seulement les messages sans date de lecture (non lus). */
  unreadOnly?: boolean;
};

/** Boîte de réception : non archivés et sans aucune trace de traitement. */
export function boiteInboxWhere(
  extras?: BoiteInboxListExtras,
): Prisma.InboundMessageWhereInput {
  return {
    archived: false,
    inboundAddress: { isActive: true },
    AND: [
      { NOT: whereHasSuccessfulForward },
      { NOT: whereHasInboxBlockingTreatment },
    ],
    ...(extras?.unreadOnly ? { readAt: null } : {}),
  };
}

export function parseBoiteInboxPagination(sp: {
  page?: string;
  perPage?: string;
}): { page: number; perPage: BoiteInboxPerPage } {
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const parsedPer = Number.parseInt(sp.perPage ?? "50", 10);
  const perPage = BOITE_INBOX_PER_PAGE_OPTIONS.includes(
    parsedPer as BoiteInboxPerPage,
  )
    ? (parsedPer as BoiteInboxPerPage)
    : 50;
  return { page, perPage };
}

export type BoiteInboxListQuery = {
  page: number;
  perPage: BoiteInboxPerPage;
  unreadOnly: boolean;
};

export function parseBoiteInboxListQuery(sp: {
  page?: string;
  perPage?: string;
  unread?: string;
}): BoiteInboxListQuery {
  const base = parseBoiteInboxPagination(sp);
  const unreadOnly = sp.unread === "1" || sp.unread === "true";
  return { ...base, unreadOnly };
}

/** Construit l’URL de la boîte avec pagination / filtre non lus. */
export function boiteInboxListHref(input: {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
}): string {
  const p = new URLSearchParams();
  if (input.page != null && input.page > 1) {
    p.set("page", String(input.page));
  }
  if (input.perPage != null && input.perPage !== 50) {
    p.set("perPage", String(input.perPage));
  }
  if (input.unreadOnly) {
    p.set("unread", "1");
  }
  const q = p.toString();
  return q ? `/boite?${q}` : "/boite";
}

export async function countBoiteMessages(
  extras?: BoiteInboxListExtras,
): Promise<number> {
  return prisma.inboundMessage.count({ where: boiteInboxWhere(extras) });
}

export async function loadBoiteMessages(
  options?: { skip?: number; take?: number; extras?: BoiteInboxListExtras },
): Promise<BoiteListMessage[]> {
  const skip = options?.skip ?? 0;
  const take = options?.take ?? 150;
  return (await prisma.inboundMessage.findMany({
    where: boiteInboxWhere(options?.extras),
    orderBy: { receivedAt: "desc" },
    skip,
    take,
    select: boiteListMessageSelect,
  })) as unknown as BoiteListMessage[];
}

/**
 * Même critère que la page `app/boite/[id]/page.tsx` : évite une navigation vers un 404.
 */
export async function inboundMessageExistsForBoiteDetail(
  id: number,
): Promise<boolean> {
  const row = await prisma.inboundMessage.findFirst({
    where: { id, inboundAddress: { isActive: true } },
    select: { id: true },
  });
  return row != null;
}

/**
 * Messages traités : archivés, ou avec transfert / trace d’action (règle, raccourci, etc.).
 * Non retirés de la liste par l’utilisateur.
 */
export async function loadTraiteMessages(take = 150): Promise<BoiteListMessage[]> {
  return (await prisma.inboundMessage.findMany({
    where: {
      inboundAddress: { isActive: true },
      hiddenFromTransferList: false,
      OR: [
        { archived: true },
        whereHasSuccessfulForward,
        whereHasTreatmentLog,
      ],
    },
    orderBy: { receivedAt: "desc" },
    take,
    select: boiteListMessageSelect,
  })) as unknown as BoiteListMessage[];
}

/** @deprecated Utiliser loadTraiteMessages */
export const loadTransferredMessages = loadTraiteMessages;
