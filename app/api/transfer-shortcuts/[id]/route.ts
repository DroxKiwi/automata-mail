import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeEmailArrayInput,
  parseEmailsFromText,
  validateDestinataireList,
} from "@/lib/reglages/transfer-shortcut-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  let emails: string[] = [];
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.raw === "string") {
      emails = parseEmailsFromText(b.raw);
    } else if ("emails" in b) {
      emails = normalizeEmailArrayInput(b.emails);
    }
  }

  const err = validateDestinataireList(emails);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const existing = await prisma.transferShortcut.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  await prisma.transferShortcut.updateMany({
    where: { id, userId: user.id },
    data: { emails },
  });
  const row = await prisma.transferShortcut.findFirst({
    where: { id, userId: user.id },
    select: { id: true, emails: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  return NextResponse.json({ shortcut: row });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  const result = await prisma.transferShortcut.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
