import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type MailFlowActor = "next" | "smtp-gateway";

/**
 * Ecrit une ligne de suivi (ne doit pas faire echouer le traitement mail).
 */
export async function mailFlowLogSafe(params: {
  correlationId: string;
  actor: MailFlowActor;
  step: string;
  direction: "in" | "out";
  summary: string;
  detail?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    const summary =
      params.summary.length > 4000
        ? `${params.summary.slice(0, 3997)}...`
        : params.summary;

    await prisma.mailFlowEvent.create({
      data: {
        correlationId: params.correlationId,
        actor: params.actor,
        step: params.step,
        direction: params.direction,
        summary,
        detail: params.detail ?? undefined,
      },
    });
  } catch (err) {
    console.error("[mail-flow-log]", err);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeCorrelationId(traceId: string | undefined): string {
  const t = typeof traceId === "string" ? traceId.trim() : "";
  if (t && UUID_RE.test(t)) {
    return t.toLowerCase();
  }
  return crypto.randomUUID();
}
