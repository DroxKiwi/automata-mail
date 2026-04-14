import type { Prisma } from "@prisma/client";
import { buildHeaderLookup, parseInboundMime } from "@/lib/inbound/mime";
import { markForwardFailedIfImportedMessageIsBounce } from "@/lib/gmail/reconcile-forward-bounce";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";
import { getOutlookAccessTokenFromDb } from "./oauth";

const OUTLOOK_SYNC_LOCAL = "outlook-sync";
const OUTLOOK_SYNC_DOMAIN = "outlook-sync.local";
const MAX_MESSAGES_PER_SYNC = 40;

type GraphMessageListItem = {
  id?: string;
  isRead?: boolean;
  receivedDateTime?: string;
};

function readAtFromOutlookItem(m: GraphMessageListItem): Date | null {
  if (m.isRead !== true) {
    return null;
  }
  const iso = m.receivedDateTime;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
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

async function ensureOutlookInboundAddressId(userId: number): Promise<number> {
  const key = {
    localPart: OUTLOOK_SYNC_LOCAL,
    domain: OUTLOOK_SYNC_DOMAIN,
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
    throw new Error("Impossible de creer l adresse Outlook sync.");
  }
}

export type OutlookSyncResult =
  | {
      ok: true;
      imported: number;
      skippedAlready: number;
      fetchErrors: number;
    }
  | { ok: false; error: string };

async function graphGetJson(
  accessToken: string,
  pathAndQuery: string
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; text: string }> {
  const url = `https://graph.microsoft.com/v1.0${pathAndQuery}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text: text.slice(0, 500) };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: res.status, text: "JSON invalide" };
  }
}

/**
 * Importe les messages Outlook (Graph) absents en base (dédup par outlookMessageId).
 */
export async function syncOutlookToBoite(userId: number): Promise<OutlookSyncResult> {
  const accessToken = await getOutlookAccessTokenFromDb(userId);
  if (!accessToken) {
    return {
      ok: false,
      error: "Outlook non connecte (refresh token manquant ou fournisseur inactif).",
    };
  }

  const settings = await prisma.outlookOAuthSettings.findUnique({
    where: { userId },
    select: { outlookSyncUnreadOnly: true },
  });
  const unreadOnly = settings?.outlookSyncUnreadOnly !== false;

  const meRes = await graphGetJson(accessToken, "/me?$select=mail,userPrincipalName");
  if (!meRes.ok) {
    return {
      ok: false,
      error: `Graph /me : ${meRes.status} ${meRes.text}`,
    };
  }
  const me = meRes.data as { mail?: string; userPrincipalName?: string };
  const meEmail =
    (typeof me.mail === "string" && me.mail.trim()) ||
    (typeof me.userPrincipalName === "string" && me.userPrincipalName.trim()) ||
    "me@localhost";
  const rcptTo: string[] = [meEmail];

  const filter = unreadOnly ? "&$filter=isRead%20eq%20false" : "";
  const listPath = `/me/mailFolders/inbox/messages?$top=${MAX_MESSAGES_PER_SYNC}&$orderby=receivedDateTime%20desc&$select=id,isRead,receivedDateTime${filter}`;

  const listRes = await graphGetJson(accessToken, listPath);
  if (!listRes.ok) {
    return {
      ok: false,
      error: `Graph liste boite : ${listRes.status} ${listRes.text}`,
    };
  }
  const listData = listRes.data as { value?: GraphMessageListItem[] };
  const refs = listData.value ?? [];
  if (refs.length === 0) {
    return { ok: true, imported: 0, skippedAlready: 0, fetchErrors: 0 };
  }

  const graphIds = refs
    .map((r) => r.id)
    .filter((id): id is string => Boolean(id));
  const already = await prisma.inboundMessage.findMany({
    where: { userId, outlookMessageId: { in: graphIds } },
    select: { outlookMessageId: true },
  });
  const alreadySet = new Set(
    already
      .map((a) => a.outlookMessageId)
      .filter((id): id is string => Boolean(id))
  );

  const inboundAddressId = await ensureOutlookInboundAddressId(userId);

  let imported = 0;
  let skippedAlready = alreadySet.size;
  let fetchErrors = 0;

  for (const item of refs) {
    const graphId = item.id;
    if (!graphId) {
      continue;
    }
    const readAt = readAtFromOutlookItem(item);

    if (alreadySet.has(graphId)) {
      try {
        await prisma.inboundMessage.updateMany({
          where: { userId, outlookMessageId: graphId },
          data: { readAt },
        });
      } catch {
        fetchErrors += 1;
      }
      continue;
    }

    const mimeRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(graphId)}/$value`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!mimeRes.ok) {
      fetchErrors += 1;
      continue;
    }
    const rawMime = await mimeRes.text();
    if (!rawMime.trim()) {
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

    const mailFrom = resolveMailFromForStorage(parsed) || "unknown@invalid";
    const receivedAt = item.receivedDateTime
      ? new Date(item.receivedDateTime)
      : new Date();
    const correlationId = `outlook:${graphId}`;

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
          outlookMessageId: graphId,
          correlationId,
          messageIdHeader: parsed.messageIdHeader,
          mailFrom,
          rcptTo: rcptTo as unknown as Prisma.InputJsonValue,
          subject: parsed.subject,
          rawMime,
          textBody: parsed.textBody,
          htmlBody: parsed.htmlBody,
          headers: parsed.headersJson as Prisma.InputJsonValue,
          receivedAt:
            Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
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
        step: "outlook_inbox_imported",
        direction: "in",
        summary: `Message Outlook importe #${message.id} (${graphId})`,
        detail: { inboundMessageId: message.id, outlookMessageId: graphId },
      });

      imported += 1;
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : "";
      if (code === "P2002") {
        skippedAlready += 1;
      } else {
        fetchErrors += 1;
      }
    }
  }

  return { ok: true, imported, skippedAlready, fetchErrors };
}
