import { CloudMailboxProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { wipeAllMailAppData } from "@/lib/mailbox/wipe-mail-data";
import { ensureAppMailboxSettingsRow, getActiveCloudProvider } from "@/lib/mailbox/provider";
import { prisma } from "@/lib/db/prisma";

function parseBodyProvider(v: unknown): CloudMailboxProvider | null {
  if (v === "GOOGLE") return CloudMailboxProvider.GOOGLE;
  if (v === "OUTLOOK") return CloudMailboxProvider.OUTLOOK;
  return null;
}

/**
 * Indique si le passage d’un fournisseur cloud à l’autre impose une remise à zéro des données mail.
 */
function switchingCloudProvidersRequiresWipe(
  from: CloudMailboxProvider,
  to: CloudMailboxProvider
): boolean {
  if (from === to) return false;
  if (from === CloudMailboxProvider.NONE || to === CloudMailboxProvider.NONE) {
    return false;
  }
  return from !== to;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await ensureAppMailboxSettingsRow();
  const activeProvider = await getActiveCloudProvider();

  return NextResponse.json({
    activeProvider,
  });
}

export async function POST(request: Request) {
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
  const next = parseBodyProvider(b.provider);
  if (!next) {
    return NextResponse.json(
      { error: "provider doit etre GOOGLE ou OUTLOOK." },
      { status: 400 }
    );
  }

  await ensureAppMailboxSettingsRow();
  const current = await getActiveCloudProvider();

  if (current === next) {
    return NextResponse.json({ ok: true, activeProvider: current, wiped: false });
  }

  const needsWipe = switchingCloudProvidersRequiresWipe(current, next);
  if (needsWipe && b.confirmWipe !== true) {
    return NextResponse.json(
      {
        error: "confirmWipe requis",
        code: "CONFIRM_WIPE_REQUIRED",
        needsWipe: true,
      },
      { status: 400 }
    );
  }

  if (needsWipe) {
    await wipeAllMailAppData();
    await prisma.googleOAuthSettings.update({
      where: { id: 1 },
      data: { refreshToken: null },
    });
    await prisma.outlookOAuthSettings.update({
      where: { id: 1 },
      data: { refreshToken: null },
    });
  }

  await prisma.appMailboxSettings.update({
    where: { id: 1 },
    data: { activeProvider: next },
  });

  return NextResponse.json({
    ok: true,
    activeProvider: next,
    wiped: needsWipe,
  });
}
