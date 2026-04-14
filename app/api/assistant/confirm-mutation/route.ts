import { NextResponse } from "next/server";
import { applyArchiveInboxMessage } from "@/lib/assistant/archive-inbox-request";
import { consumePendingMutation } from "@/lib/assistant/pending-mutations";
import { assistantRequestOriginError } from "@/lib/assistant/request-guard";
import { getSessionUser } from "@/lib/auth";

/**
 * Applique une mutation préalablement demandée par l’assistant (jeton à usage unique).
 * Non destiné aux scripts publics : session + origine (si fournie) requises.
 */
export async function POST(request: Request) {
  const originErr = assistantRequestOriginError(request);
  if (originErr) {
    return NextResponse.json({ error: originErr }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const token =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token.trim()
      : "";

  if (!token) {
    return NextResponse.json({ error: "token requis." }, { status: 400 });
  }

  const pending = consumePendingMutation(token, user.id);
  if (!pending) {
    return NextResponse.json(
      { error: "Jeton invalide, expire ou deja utilise." },
      { status: 400 },
    );
  }

  if (pending.kind === "archive_inbox_message") {
    const r = await applyArchiveInboxMessage(pending.messageId);
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      kind: pending.kind,
      messageId: pending.messageId,
    });
  }

  return NextResponse.json(
    { error: "Type de mutation inconnu." },
    { status: 400 },
  );
}
