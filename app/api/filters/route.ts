import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { type ConditionInput, validateConditions } from "@/lib/rules/rules-payload";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const filters = await prisma.filter.findMany({
    orderBy: [{ priority: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      enabled: true,
      priority: true,
      inboundAddress: {
        select: { localPart: true, domain: true },
      },
      _count: { select: { conditions: true } },
    },
  });

  return NextResponse.json({ filters });
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

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nom du filtre requis." }, { status: 400 });
  }

  const description =
    typeof b.description === "string" ? b.description.trim() || null : null;
  const enabled = b.enabled !== false;
  const priority =
    typeof b.priority === "number" && Number.isFinite(b.priority)
      ? Math.floor(b.priority)
      : 100;

  let inboundAddressId: number | null = null;
  if (b.inboundAddressId != null && b.inboundAddressId !== "") {
    const id = Number(b.inboundAddressId);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "Adresse d entree invalide." },
        { status: 400 },
      );
    }
    inboundAddressId = id;
    const addr = await prisma.inboundAddress.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!addr) {
      return NextResponse.json(
        { error: "Adresse d entree introuvable." },
        { status: 400 },
      );
    }
  }

  const conditions = b.conditions as ConditionInput[];
  const condErr = validateConditions(conditions);
  if (condErr) {
    return NextResponse.json({ error: condErr }, { status: 400 });
  }

  const conditionCreates: Prisma.FilterConditionCreateWithoutFilterInput[] =
    conditions.map((c, index) => ({
      field: c.field,
      headerName:
        c.field === "HEADER" ? (c.headerName ?? "").trim() || null : null,
      operator: c.operator,
      value: c.value,
      caseSensitive: Boolean(c.caseSensitive),
      sortOrder: index,
    }));

  const filter = await prisma.filter.create({
    data: {
      inboundAddressId,
      name,
      description,
      enabled,
      priority,
      conditions: { create: conditionCreates },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, filter });
}
