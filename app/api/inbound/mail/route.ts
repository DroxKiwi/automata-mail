import { NextResponse } from "next/server";
import { parseInboundMime } from "@/lib/inbound/mime";
import { parseSmtpAddress } from "@/lib/inbound/recipient";
import { processInboundForAddress } from "@/lib/inbound/rule-runner";
import {
  mailFlowLogSafe,
  normalizeCorrelationId,
} from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

type InboundPayload = {
  traceId?: string;
  mailFrom?: string;
  rcptTo?: string[];
  remoteIp?: string;
  raw?: string;
};

export async function POST(request: Request) {
  const expectedSecret = process.env.INBOUND_SECRET;
  const providedSecret = request.headers.get("x-inbound-secret");

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "INBOUND_SECRET non configure." },
      { status: 500 }
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InboundPayload;
  try {
    body = (await request.json()) as InboundPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const correlationId = normalizeCorrelationId(body.traceId);

  const rawMime = typeof body.raw === "string" ? body.raw : "";
  const mailFrom = typeof body.mailFrom === "string" ? body.mailFrom : "";
  const rcptList = Array.isArray(body.rcptTo)
    ? body.rcptTo.filter((x): x is string => typeof x === "string")
    : [];
  const remoteIp =
    typeof body.remoteIp === "string" ? body.remoteIp : "unknown";

  await mailFlowLogSafe({
    correlationId,
    actor: "next",
    step: "api_inbound_received",
    direction: "in",
    summary: `Webhook /api/inbound/mail (${rcptList.length} destinataire(s), ${rawMime.length} octets brut)`,
    detail: {
      mailFrom,
      rcptTo: rcptList,
      remoteIp,
      rawSize: rawMime.length,
    },
  });

  let parsedMime;
  try {
    parsedMime = await parseInboundMime(rawMime || "");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur parse MIME";
    console.error("[inbound-mail] MIME parse error:", msg);
    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "api_inbound_mime_error",
      direction: "in",
      summary: `Echec analyse MIME: ${msg.slice(0, 200)}`,
      detail: { error: msg },
    });
    return NextResponse.json(
      { error: "Corps MIME invalide ou illisible.", traceId: correlationId },
      { status: 400 }
    );
  }

  const seenAddressIds = new Set<number>();
  const results: {
    inboundAddressId: number;
    inboundMessageId?: number;
    error?: string;
  }[] = [];

  for (const rcpt of rcptList) {
    const parts = parseSmtpAddress(rcpt);
    if (!parts) {
      continue;
    }

    const addr = await prisma.inboundAddress.findFirst({
      where: {
        isActive: true,
        domain: parts.domain,
        localPart: { equals: parts.localPart, mode: "insensitive" },
      },
      select: { id: true, userId: true },
    });

    if (!addr) {
      continue;
    }

    if (seenAddressIds.has(addr.id)) {
      continue;
    }
    seenAddressIds.add(addr.id);

    try {
      const { inboundMessageId } = await processInboundForAddress({
        userId: addr.userId,
        inboundAddressId: addr.id,
        mailFrom,
        rcptTo: rcptList,
        rawMime,
        parsed: parsedMime,
        correlationId,
      });
      results.push({ inboundAddressId: addr.id, inboundMessageId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[inbound-mail] process error", addr.id, msg);
      await mailFlowLogSafe({
        correlationId,
        actor: "next",
        step: "api_inbound_process_error",
        direction: "in",
        summary: `Erreur traitement adresse #${addr.id}: ${msg.slice(0, 200)}`,
        detail: { inboundAddressId: addr.id, error: msg },
      });
      results.push({ inboundAddressId: addr.id, error: msg });
    }
  }

  if (seenAddressIds.size === 0) {
    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "api_inbound_no_recipient",
      direction: "in",
      summary:
        "Aucune InboundAddress active ne correspond aux destinataires du message",
      detail: { rcptTo: rcptList },
    });
  }

  console.log("[inbound-mail] done", {
    traceId: correlationId,
    mailFrom,
    rcptTo: rcptList,
    remoteIp,
    rawSize: rawMime.length,
    matchedAddresses: seenAddressIds.size,
  });

  return NextResponse.json({
    ok: true,
    traceId: correlationId,
    matchedRecipients: seenAddressIds.size,
    results,
  });
}
