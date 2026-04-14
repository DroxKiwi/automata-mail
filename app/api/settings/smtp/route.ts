import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const row = await prisma.smtpOutboundSettings.findUnique({
    where: { userId: user.id },
  });

  const dbHost = row?.host?.trim() ?? "";
  const smtpConfigured = Boolean(dbHost && row?.fromAddress?.trim());

  return NextResponse.json({
    host: row?.host ?? "",
    port: row?.port ?? 587,
    secure: row?.secure ?? false,
    authUser: row?.authUser ?? "",
    fromAddress: row?.fromAddress ?? "",
    hasPassword: Boolean(row?.authPassword?.trim()),
    smtpConfigured,
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

  const host = typeof b.host === "string" ? b.host.trim() : "";
  const port =
    typeof b.port === "number" && Number.isFinite(b.port)
      ? Math.floor(b.port)
      : typeof b.port === "string"
        ? Number.parseInt(b.port, 10)
        : 587;
  const secure = b.secure === true;
  const authUser =
    typeof b.authUser === "string" ? b.authUser.trim() : "";
  const fromAddress =
    typeof b.fromAddress === "string" ? b.fromAddress.trim() : "";

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: "Port invalide." }, { status: 400 });
  }

  if (host && !fromAddress) {
    return NextResponse.json(
      { error: "L'adresse d'expedition (From) est requise si un serveur SMTP est renseigne." },
      { status: 400 }
    );
  }

  const updateData: Prisma.SmtpOutboundSettingsUpdateInput = {
    host,
    port,
    secure,
    authUser: authUser || null,
    fromAddress,
  };

  if (typeof b.authPassword === "string" && b.authPassword.length > 0) {
    updateData.authPassword = b.authPassword;
  }

  await prisma.smtpOutboundSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      host,
      port,
      secure,
      authUser: authUser || null,
      authPassword:
        typeof b.authPassword === "string" && b.authPassword.length > 0
          ? b.authPassword
          : null,
      fromAddress,
    },
    update: updateData,
  });

  return NextResponse.json({ ok: true });
}
