import { NextResponse } from "next/server";
import { runRulesForPendingInboundMessages } from "@/lib/inbound/rule-worker";
import { runCloudInboxSync } from "@/lib/mail/cloud-sync";
import { assertWorkerBearer } from "@/lib/auth/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Enchaîne sync cloud puis traitement des règles (un seul appel depuis le robot).
 * Auth : `Authorization: Bearer <WORKER_TRIGGER_SECRET>`.
 */
export async function POST(request: Request) {
  const denied = assertWorkerBearer(request);
  if (denied) {
    return denied;
  }

  let processLimit = 40;
  try {
    const body = await request.json().catch(() => ({}));
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as { limit?: unknown }).limit === "number"
    ) {
      const n = Math.floor((body as { limit: number }).limit);
      if (Number.isFinite(n) && n >= 1 && n <= 200) {
        processLimit = n;
      }
    }
  } catch {
    /* défaut */
  }

  const syncResult = await runCloudInboxSync();
  const syncPayload = syncResult.ok
    ? {
        ok: true as const,
        provider: syncResult.provider,
        imported: syncResult.imported,
        skippedAlready: syncResult.skippedAlready,
        fetchErrors: syncResult.fetchErrors,
      }
    : { ok: false as const, error: syncResult.error };

  const { processed, errors } = await runRulesForPendingInboundMessages({
    limit: processLimit,
  });

  return NextResponse.json({
    ok: true,
    step: "tick",
    sync: syncPayload,
    process: {
      processed,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
    },
  });
}
