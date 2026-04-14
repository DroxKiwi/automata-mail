import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGmailClientFromDb } from "@/lib/gmail/oauth";

/**
 * Vérifie que le refresh token en base permet d’appeler l’API Gmail (liste 5 ids).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const gmail = await getGmailClientFromDb();
  if (!gmail) {
    return NextResponse.json(
      {
        error:
          "Gmail non connecte : renseigne OAuth dans Reglages puis utilise « Connecter Gmail ».",
      },
      { status: 503 }
    );
  }

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 5,
    });
    const ids =
      res.data.messages?.map((m) => m.id).filter(Boolean) ?? [];
    return NextResponse.json({
      ok: true,
      messageCountSample: ids.length,
      messageIds: ids,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
