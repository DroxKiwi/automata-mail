import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runCloudInboxSync } from "@/lib/mail/cloud-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await runCloudInboxSync();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    imported: result.imported,
    skippedAlready: result.skippedAlready,
    fetchErrors: result.fetchErrors,
  });
}
