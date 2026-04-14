import { ActionLogStatus } from "@prisma/client";
import { normalizeRfcMessageId } from "@/lib/gmail/rfc-message-id";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";

/**
 * Extrait le Message-ID du message d’origine depuis une notification d’échec (souvent
 * `X-Original-Message-ID` dans le corps / RFC822 du rebond).
 */
export function extractOriginalMessageIdFromBounce(
  rawMime: string,
  textBody: string | null,
): string | null {
  const blob = `${rawMime}\n${textBody ?? ""}`;
  const angle = blob.match(/X-Original-Message-ID:\s*<([^>\r\n]+)>/i);
  if (angle?.[1]) {
    return normalizeRfcMessageId(angle[1]);
  }
  const loose = blob.match(/X-Original-Message-ID:\s*<?\s*(\S+@\S+)/i);
  if (loose?.[1]) {
    return normalizeRfcMessageId(loose[1].replace(/[>,;]+$/, ""));
  }
  return null;
}

export function isLikelyDeliveryFailureNotice(args: {
  mailFrom: string;
  subject: string | null;
  rawMime: string;
}): boolean {
  const from = args.mailFrom.toLowerCase();
  const sub = (args.subject ?? "").toLowerCase();
  const raw = args.rawMime;
  if (from.includes("mailer-daemon")) return true;
  if (from.includes("postmaster@")) return true;
  if (/mail delivery subsystem/i.test(args.mailFrom)) return true;
  if (sub.includes("delivery status notification") && sub.includes("failure")) return true;
  if (sub.includes("undeliverable")) return true;
  if (sub.includes("adresse introuvable")) return true;
  if (sub.includes("message non remis") || sub.includes("non remis")) return true;
  if (raw.includes("Action: failed") && (raw.includes("Status: 5.") || raw.includes("Diagnostic-Code:"))) {
    return true;
  }
  if (raw.includes("550-5.1.1") || raw.includes("550 5.1.1")) return true;
  return false;
}

function pickBounceReason(raw: string, text: string | null): string {
  const blob = `${raw}\n${text ?? ""}`;
  const diag = blob.match(/Diagnostic-Code:\s*([^\r\n]+)/i);
  if (diag?.[1]) return diag[1].trim().slice(0, 500);
  const status = blob.match(/Status:\s*([^\r\n]+)/i);
  if (status?.[1]) return status[1].trim().slice(0, 500);
  return "Echec de livraison (notification du serveur distant).".slice(0, 500);
}

/**
 * Si le message importé depuis Gmail est un rebond d’échec de livraison, met à jour
 * le journal de transfert correspondant (FORWARD en SENT → FAILED).
 * L’API Gmail accepte l’envoi avant la livraison ; l’échec 550 arrive souvent via ce courrier.
 */
export async function markForwardFailedIfImportedMessageIsBounce(input: {
  correlationId: string;
  mailFrom: string;
  subject: string | null;
  rawMime: string;
  textBody: string | null;
}): Promise<{ updated: number }> {
  if (
    !isLikelyDeliveryFailureNotice({
      mailFrom: input.mailFrom,
      subject: input.subject,
      rawMime: input.rawMime,
    })
  ) {
    return { updated: 0 };
  }

  const originalId = extractOriginalMessageIdFromBounce(input.rawMime, input.textBody);
  if (!originalId) {
    return { updated: 0 };
  }

  const candidates = await prisma.messageActionLog.findMany({
    where: { status: ActionLogStatus.SENT },
    select: { id: true, detail: true, inboundMessageId: true },
  });

  let updated = 0;
  for (const row of candidates) {
    const d = row.detail as Record<string, unknown> | null;
    if (!d || d.type !== "FORWARD") continue;
    const stored =
      typeof d.outboundRfcMessageId === "string" ? d.outboundRfcMessageId.trim() : "";
    if (!stored || stored !== originalId) continue;

    const reason = pickBounceReason(input.rawMime, input.textBody);
    await prisma.messageActionLog.update({
      where: { id: row.id },
      data: {
        status: ActionLogStatus.FAILED,
        detail: {
          ...d,
          bounceDetected: true,
          bounceReason: reason,
        },
      },
    });
    updated += 1;

    await mailFlowLogSafe({
      correlationId: input.correlationId,
      actor: "next",
      step: "gmail_delivery_failure_reconciled",
      direction: "in",
      summary: `Echec de livraison detecte (rebond) pour transfert inboundMessageId=${row.inboundMessageId}`,
      detail: {
        messageActionLogId: row.id,
        inboundMessageId: row.inboundMessageId,
        originalMessageId: originalId,
      },
    });
  }

  return { updated };
}
