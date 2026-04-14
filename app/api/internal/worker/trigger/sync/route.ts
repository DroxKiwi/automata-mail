import { NextResponse } from "next/server";
import { assertWorkerBearer } from "@/lib/auth/worker-auth";
import { runCloudInboxSync } from "@/lib/mail/cloud-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Déclenche la synchronisation de la boîte cloud (Gmail / Outlook) vers la base locale.
 * Auth : `Authorization: Bearer <WORKER_TRIGGER_SECRET>`.
 */
export async function POST(request: Request) {
  const denied = assertWorkerBearer(request);
  if (denied) {
    return denied;
  }

  const result = await runCloudInboxSync();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    step: "sync",
    provider: result.provider,
    imported: result.imported,
    skippedAlready: result.skippedAlready,
    fetchErrors: result.fetchErrors,
  });
}
