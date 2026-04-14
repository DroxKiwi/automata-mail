import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { isAllowedGmailPollIntervalSeconds } from "@/lib/gmail/poll-interval";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const row = await prisma.googleOAuthSettings.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    clientId: row?.clientId ?? "",
    redirectUri: row?.redirectUri ?? "",
    hasClientSecret: Boolean(row?.clientSecret?.trim()),
    hasRefreshToken: Boolean(row?.refreshToken?.trim()),
    gmailPollIntervalSeconds: row?.gmailPollIntervalSeconds ?? 0,
    gmailSyncUnreadOnly: row?.gmailSyncUnreadOnly ?? true,
    gmailMarkReadOnOpen: row?.gmailMarkReadOnOpen ?? false,
  });
}

export async function PUT(request: Request) {
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const updateData: Prisma.GoogleOAuthSettingsUpdateInput = {};

  if ("clientId" in b && typeof b.clientId === "string") {
    updateData.clientId = b.clientId.trim();
  }
  if ("redirectUri" in b && typeof b.redirectUri === "string") {
    updateData.redirectUri = b.redirectUri.trim();
  }
  if (typeof b.clientSecret === "string" && b.clientSecret.length > 0) {
    updateData.clientSecret = b.clientSecret.trim();
  }
  if (b.clearRefreshToken === true) {
    updateData.refreshToken = null;
  }

  if ("gmailPollIntervalSeconds" in b) {
    const raw = b.gmailPollIntervalSeconds;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseInt(raw, 10)
          : NaN;
    const sec = Math.floor(n);
    if (!Number.isFinite(sec) || !isAllowedGmailPollIntervalSeconds(sec)) {
      return NextResponse.json(
        { error: "gmailPollIntervalSeconds doit etre une valeur parmi les intervalles proposes." },
        { status: 400 }
      );
    }
    updateData.gmailPollIntervalSeconds = sec;
  }

  if ("gmailSyncUnreadOnly" in b && typeof b.gmailSyncUnreadOnly === "boolean") {
    updateData.gmailSyncUnreadOnly = b.gmailSyncUnreadOnly;
  }
  if ("gmailMarkReadOnOpen" in b && typeof b.gmailMarkReadOnOpen === "boolean") {
    updateData.gmailMarkReadOnOpen = b.gmailMarkReadOnOpen;
  }

  const clientId =
    "clientId" in b && typeof b.clientId === "string" ? b.clientId.trim() : "";
  const redirectUri =
    "redirectUri" in b && typeof b.redirectUri === "string"
      ? b.redirectUri.trim()
      : "";

  await prisma.googleOAuthSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      clientId,
      redirectUri,
      clientSecret:
        typeof b.clientSecret === "string" && b.clientSecret.length > 0
          ? b.clientSecret.trim()
          : null,
      refreshToken: null,
    },
    update: updateData,
  });

  return NextResponse.json({ ok: true });
}
