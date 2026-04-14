import { NextResponse } from "next/server";
import { runRulesForPendingInboundMessages } from "@/lib/inbound/rule-worker";
import { assertWorkerBearer } from "@/lib/auth/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Applique filtres + automates (moteur de règles) aux messages en attente
 * (`rulesEvaluatedAt` null), typiquement après import cloud.
 * Auth : `Authorization: Bearer <WORKER_TRIGGER_SECRET>`.
 */
export async function POST(request: Request) {
  const denied = assertWorkerBearer(request);
  if (denied) {
    return denied;
  }

  let limit = 40;
  try {
    const body = await request.json().catch(() => ({}));
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as { limit?: unknown }).limit === "number"
    ) {
      const n = Math.floor((body as { limit: number }).limit);
      if (Number.isFinite(n) && n >= 1 && n <= 200) {
        limit = n;
      }
    }
  } catch {
    /* corps vide ou non JSON : défaut */
  }

  const { processed, errors } = await runRulesForPendingInboundMessages({ limit });

  return NextResponse.json({
    ok: true,
    step: "process",
    processed,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  });
}
