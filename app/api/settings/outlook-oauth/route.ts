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

  const row = await prisma.outlookOAuthSettings.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    clientId: row?.clientId ?? "",
    redirectUri: row?.redirectUri ?? "",
    tenantId: row?.tenantId ?? "common",
    hasClientSecret: Boolean(row?.clientSecret?.trim()),
    hasRefreshToken: Boolean(row?.refreshToken?.trim()),
    outlookPollIntervalSeconds: row?.outlookPollIntervalSeconds ?? 0,
    outlookSyncUnreadOnly: row?.outlookSyncUnreadOnly ?? true,
    outlookMarkReadOnOpen: row?.outlookMarkReadOnOpen ?? false,
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

  const updateData: Prisma.OutlookOAuthSettingsUpdateInput = {};

  if ("clientId" in b && typeof b.clientId === "string") {
    updateData.clientId = b.clientId.trim();
  }
  if ("redirectUri" in b && typeof b.redirectUri === "string") {
    updateData.redirectUri = b.redirectUri.trim();
  }
  if ("tenantId" in b && typeof b.tenantId === "string") {
    const t = b.tenantId.trim();
    updateData.tenantId = t || "common";
  }
  if (typeof b.clientSecret === "string" && b.clientSecret.length > 0) {
    updateData.clientSecret = b.clientSecret.trim();
  }
  if (b.clearRefreshToken === true) {
    updateData.refreshToken = null;
  }

  if ("outlookPollIntervalSeconds" in b) {
    const raw = b.outlookPollIntervalSeconds;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseInt(raw, 10)
          : NaN;
    const sec = Math.floor(n);
    if (!Number.isFinite(sec) || !isAllowedGmailPollIntervalSeconds(sec)) {
      return NextResponse.json(
        {
          error:
            "outlookPollIntervalSeconds doit etre une valeur parmi les intervalles proposes (meme liste que Gmail).",
        },
        { status: 400 }
      );
    }
    updateData.outlookPollIntervalSeconds = sec;
  }

  if ("outlookSyncUnreadOnly" in b && typeof b.outlookSyncUnreadOnly === "boolean") {
    updateData.outlookSyncUnreadOnly = b.outlookSyncUnreadOnly;
  }
  if ("outlookMarkReadOnOpen" in b && typeof b.outlookMarkReadOnOpen === "boolean") {
    updateData.outlookMarkReadOnOpen = b.outlookMarkReadOnOpen;
  }

  const clientId =
    "clientId" in b && typeof b.clientId === "string" ? b.clientId.trim() : "";
  const redirectUri =
    "redirectUri" in b && typeof b.redirectUri === "string"
      ? b.redirectUri.trim()
      : "";
  const tenantId =
    "tenantId" in b && typeof b.tenantId === "string"
      ? b.tenantId.trim() || "common"
      : "common";

  await prisma.outlookOAuthSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      clientId,
      redirectUri,
      tenantId,
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
