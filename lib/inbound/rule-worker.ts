import { prisma } from "@/lib/db/prisma";
import type { ParsedInboundMime } from "@/lib/inbound/mime";
import { runRulesEngineForInboundMessage } from "@/lib/inbound/rule-runner";

const DEFAULT_BATCH = 40;

function headersToRecord(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof v === "string") {
      out[k] = v;
    } else if (v != null) {
      out[k] = String(v);
    }
  }
  return out;
}

/**
 * Applique le moteur de règles aux messages dont `rulesEvaluatedAt` est encore null
 * (ex. import Gmail/Outlook sans passage par l’API inbound MTA).
 */
export async function runRulesForPendingInboundMessages(options?: {
  limit?: number;
}): Promise<{ processed: number; errors: string[] }> {
  const limit = options?.limit ?? DEFAULT_BATCH;
  const pending = await prisma.inboundMessage.findMany({
    where: { rulesEvaluatedAt: null },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: {
      id: true,
      inboundAddressId: true,
      mailFrom: true,
      rawMime: true,
      subject: true,
      textBody: true,
      htmlBody: true,
      headers: true,
      messageIdHeader: true,
      correlationId: true,
    },
  });

  const errors: string[] = [];
  let processed = 0;

  for (const row of pending) {
    try {
      const parsed: ParsedInboundMime = {
        messageIdHeader: row.messageIdHeader,
        subject: row.subject,
        textBody: row.textBody,
        htmlBody: row.htmlBody,
        headersJson: headersToRecord(row.headers),
        attachments: [],
        envelopeFrom: null,
      };

      await runRulesEngineForInboundMessage({
        inboundMessageId: row.id,
        inboundAddressId: row.inboundAddressId,
        mailFrom: row.mailFrom,
        rawMime: row.rawMime,
        parsed,
        correlationId: row.correlationId,
      });

      await prisma.inboundMessage.update({
        where: { id: row.id },
        data: { rulesEvaluatedAt: new Date() },
      });
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`#${row.id}: ${msg.slice(0, 200)}`);
    }
  }

  return { processed, errors };
}
