import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOutlookAccessTokenFromDb } from "@/lib/outlook/oauth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const token = await getOutlookAccessTokenFromDb();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Outlook non connecte : renseigne OAuth dans Reglages puis utilise « Connecter Outlook ».",
      },
      { status: 503 }
    );
  }

  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=5&$select=id",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const t = (await res.text()).slice(0, 300);
    return NextResponse.json({ error: `${res.status} ${t}` }, { status: 502 });
  }
  const data = (await res.json()) as { value?: Array<{ id?: string }> };
  const ids = data.value?.map((m) => m.id).filter(Boolean) ?? [];
  return NextResponse.json({
    ok: true,
    messageCountSample: ids.length,
    messageIds: ids,
  });
}
