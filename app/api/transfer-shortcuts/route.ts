import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeEmailArrayInput,
  parseEmailsFromText,
  validateDestinataireList,
} from "@/lib/reglages/transfer-shortcut-utils";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const items = await prisma.transferShortcut.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, emails: true },
  });

  return NextResponse.json({ shortcuts: items });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
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
    } else if (typeof b.email === "string") {
      emails = parseEmailsFromText(b.email);
    }
  }

  const err = validateDestinataireList(emails);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  try {
    const row = await prisma.transferShortcut.create({
      data: { emails },
      select: { id: true, emails: true },
    });
    return NextResponse.json({ shortcut: row });
  } catch {
    return NextResponse.json(
      { error: "Impossible d'enregistrer ce raccourci." },
      { status: 500 },
    );
  }
}
