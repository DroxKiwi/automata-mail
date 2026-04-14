import type { Prisma } from "@prisma/client";
import { buildHeaderLookup, parseInboundMime } from "@/lib/inbound/mime";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";
import { resolveMailFromFromGmailApiHeaders } from "@/lib/gmail/gmail-from-header";
import { markForwardFailedIfImportedMessageIsBounce } from "@/lib/gmail/reconcile-forward-bounce";
import { getGmailClientFromDb } from "./oauth";

/** Adresse d’entrée technique pour les messages importés depuis Gmail (affichage boîte). */
const GMAIL_SYNC_LOCAL = "gmail-sync";
const GMAIL_SYNC_DOMAIN = "gmail-sync.local";

const GMAIL_QUERY_UNREAD_INBOX = "is:unread in:inbox";
const GMAIL_QUERY_INBOX_ALL = "in:inbox";

const MAX_MESSAGES_PER_SYNC = 40;

/** Libellé système Gmail : présent = message non lu côté Gmail. */
const GMAIL_LABEL_UNREAD = "UNREAD";

/**
 * `readAt` local pour l’UI : null = non lu (fond normal), date = lu (fond grisé).
 * Aligné sur Gmail : UNREAD absent ⇒ lu dans Gmail ⇒ on renseigne une date (internalDate).
 */
function readAtFromGmailMessage(meta: {
  data: {
    labelIds?: string[] | null;
    internalDate?: string | null;
  };
}): Date | null {
  const labels = meta.data.labelIds ?? [];
  if (labels.includes(GMAIL_LABEL_UNREAD)) {
    return null;
  }
  const ms = meta.data.internalDate
    ? Number.parseInt(String(meta.data.internalDate), 10)
    : NaN;
  if (Number.isFinite(ms)) {
    return new Date(ms);
  }
  return new Date();
}

function resolveMailFromForStorage(parsed: {
  headersJson: Record<string, string>;
  envelopeFrom: string | null;
}): string {
  const fromParsed = parsed.envelopeFrom?.trim();
  if (fromParsed) {
    return fromParsed;
  }
  const map = buildHeaderLookup(parsed.headersJson);
  const raw = map.get("from") ?? map.get("sender") ?? "";
  const angle = raw.match(/<([^>]+)>/);
  if (angle?.[1]) {
    return angle[1].trim();
  }
  const at = raw.match(/\S+@\S+/);
  if (at) {
    return at[0].replace(/^<|>$/g, "").trim();
  }
  return "unknown@invalid";
}

async function ensureGmailInboundAddressId(userId: number): Promise<number> {
  const key = {
    localPart: GMAIL_SYNC_LOCAL,
    domain: GMAIL_SYNC_DOMAIN,
  };
  const existing = await prisma.inboundAddress.findUnique({
    where: { userId_localPart_domain: { userId, ...key } },
  });
  if (existing) {
    return existing.id;
  }
  try {
    const created = await prisma.inboundAddress.create({
      data: {
        localPart: key.localPart,
        domain: key.domain,
        userId,
        isActive: true,
      },
    });
    return created.id;
  } catch {
    const retry = await prisma.inboundAddress.findUnique({
      where: { userId_localPart_domain: { userId, ...key } },
    });
    if (retry) {
      return retry.id;
    }
    throw new Error("Impossible de creer l adresse Gmail sync.");
  }
}

export type GmailSyncResult =
  | {
      ok: true;
      imported: number;
      skippedAlready: number;
      fetchErrors: number;
    }
  | { ok: false; error: string };

/**
 * Importe les messages Gmail absents en base (dédup par gmailMessageId).
 * Requête list : non lus uniquement ou toute la boîte (réglage `gmailSyncUnreadOnly`).
 */
export async function syncGmailToBoite(userId: number): Promise<GmailSyncResult> {
  const gmail = await getGmailClientFromDb(userId);
  if (!gmail) {
    return { ok: false, error: "Gmail non connecte (refresh token manquant)." };
  }

  const settings = await prisma.googleOAuthSettings.findUnique({
    where: { userId },
    select: { gmailSyncUnreadOnly: true },
  });
  const listQuery =
    settings?.gmailSyncUnreadOnly !== false
      ? GMAIL_QUERY_UNREAD_INBOX
      : GMAIL_QUERY_INBOX_ALL;

  const profile = await gmail.users.getProfile({ userId: "me" });
  const meEmail = profile.data.emailAddress?.trim() ?? "me@localhost";
  const rcptTo: string[] = [meEmail];

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: listQuery,
    maxResults: MAX_MESSAGES_PER_SYNC,
  });

  const refs = listRes.data.messages ?? [];
  if (refs.length === 0) {
    return { ok: true, imported: 0, skippedAlready: 0, fetchErrors: 0 };
  }

  const gmailIds = refs.map((r) => r.id).filter((id): id is string => Boolean(id));
  const already = await prisma.inboundMessage.findMany({
    where: { userId, gmailMessageId: { in: gmailIds } },
    select: { gmailMessageId: true },
  });
  const alreadySet = new Set(
    already.map((a) => a.gmailMessageId).filter((id): id is string => Boolean(id))
  );

  const inboundAddressId = await ensureGmailInboundAddressId(userId);

  let imported = 0;
  let skippedAlready = alreadySet.size;
  let fetchErrors = 0;

  for (const gmailId of gmailIds) {
    if (alreadySet.has(gmailId)) {
      try {
        const metaOnly = await gmail.users.messages.get({
          userId: "me",
          id: gmailId,
          format: "metadata",
        });
        const readAt = readAtFromGmailMessage(metaOnly);
        await prisma.inboundMessage.updateMany({
          where: { userId, gmailMessageId: gmailId },
          data: { readAt },
        });
      } catch {
        fetchErrors += 1;
      }
      continue;
    }

    let metaRes;
    let getRes;
    try {
      const pair = await Promise.all([
        gmail.users.messages.get({
          userId: "me",
          id: gmailId,
          format: "metadata",
        }),
        gmail.users.messages.get({
          userId: "me",
          id: gmailId,
          format: "raw",
        }),
      ]);
      metaRes = pair[0];
      getRes = pair[1];
    } catch {
      fetchErrors += 1;
      continue;
    }

    const readAt = readAtFromGmailMessage(metaRes);

    const fromGmail = resolveMailFromFromGmailApiHeaders(
      metaRes.data.payload?.headers ?? undefined
    );

    const rawB64 = getRes.data.raw;
    if (!rawB64) {
      fetchErrors += 1;
      continue;
    }

    let rawMime: string;
    try {
      rawMime = Buffer.from(rawB64, "base64url").toString("utf-8");
    } catch {
      fetchErrors += 1;
      continue;
    }

    let parsed;
    try {
      parsed = await parseInboundMime(rawMime);
    } catch {
      fetchErrors += 1;
      continue;
    }

    const mailFrom =
      fromGmail?.trim() ||
      resolveMailFromForStorage(parsed) ||
      "unknown@invalid";
    const internalMs = getRes.data.internalDate
      ? Number.parseInt(String(getRes.data.internalDate), 10)
      : Date.now();
    const receivedAt = new Date(Number.isFinite(internalMs) ? internalMs : Date.now());
    const correlationId = `gmail:${gmailId}`;

    await markForwardFailedIfImportedMessageIsBounce({
      correlationId,
      mailFrom,
      subject: parsed.subject,
      rawMime,
      textBody: parsed.textBody,
    });

    try {
      const message = await prisma.inboundMessage.create({
        data: {
          inboundAddressId,
          userId,
          gmailMessageId: gmailId,
          correlationId,
          messageIdHeader: parsed.messageIdHeader,
          mailFrom,
          rcptTo: rcptTo as unknown as Prisma.InputJsonValue,
          subject: parsed.subject,
          rawMime,
          textBody: parsed.textBody,
          htmlBody: parsed.htmlBody,
          headers: parsed.headersJson as Prisma.InputJsonValue,
          receivedAt,
          readAt,
        },
      });

      if (parsed.attachments.length > 0) {
        await prisma.inboundAttachment.createMany({
          data: parsed.attachments.map((a) => ({
            inboundMessageId: message.id,
            filename: a.filename,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
            contentId: a.contentId,
            disposition: a.disposition,
          })),
        });
      }

      await mailFlowLogSafe({
        userId,
        correlationId,
        actor: "next",
        step: "gmail_inbox_imported",
        direction: "in",
        summary: `Message Gmail importe #${message.id} (${gmailId})`,
        detail: { inboundMessageId: message.id, gmailMessageId: gmailId },
      });

      imported += 1;
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : "";
      if (code === "P2002") {
        skippedAlready += 1;
      } else {
        fetchErrors += 1;
      }
    }
  }

  return { ok: true, imported, skippedAlready, fetchErrors };
}
