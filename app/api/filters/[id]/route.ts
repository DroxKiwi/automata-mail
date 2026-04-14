import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { type ConditionInput, validateConditions } from "@/lib/rules/rules-payload";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  const filter = await prisma.filter.findFirst({
    where: { id, userId: user.id },
    include: {
      conditions: { orderBy: { sortOrder: "asc" } },
      inboundAddress: {
        select: { id: true, localPart: true, domain: true },
      },
    },
  });

  if (!filter) {
    return NextResponse.json({ error: "Filtre introuvable." }, { status: 404 });
  }

  return NextResponse.json({ filter });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  const existing = await prisma.filter.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Filtre introuvable." }, { status: 404 });
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

  const name =
    typeof b.name === "string" ? b.name.trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Nom du filtre requis." }, { status: 400 });
  }

  const description =
    b.description === undefined
      ? undefined
      : typeof b.description === "string"
        ? b.description.trim() || null
        : null;

  const enabled = b.enabled === undefined ? undefined : b.enabled !== false;
  const priority =
    typeof b.priority === "number" && Number.isFinite(b.priority)
      ? Math.floor(b.priority)
      : undefined;

  let inboundAddressId: number | null | undefined = undefined;
  if (b.inboundAddressId !== undefined) {
    if (b.inboundAddressId === null || b.inboundAddressId === "") {
      inboundAddressId = null;
    } else {
      const aid = Number(b.inboundAddressId);
      if (!Number.isFinite(aid)) {
        return NextResponse.json(
          { error: "Adresse d entree invalide." },
          { status: 400 },
        );
      }
      const addr = await prisma.inboundAddress.findFirst({
        where: { id: aid, userId: user.id, isActive: true },
        select: { id: true },
      });
      if (!addr) {
        return NextResponse.json(
          { error: "Adresse d entree introuvable." },
          { status: 400 },
        );
      }
      inboundAddressId = aid;
    }
  }

  const conditions = b.conditions as ConditionInput[] | undefined;
  if (conditions !== undefined) {
    const condErr = validateConditions(conditions);
    if (condErr) {
      return NextResponse.json({ error: condErr }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (conditions !== undefined) {
      await tx.filterCondition.deleteMany({ where: { filterId: id, filter: { userId: user.id } } });
      if (conditions.length > 0) {
        await tx.filterCondition.createMany({
          data: conditions.map((c, index) => ({
            filterId: id,
            field: c.field,
            headerName:
              c.field === "HEADER" ? (c.headerName ?? "").trim() || null : null,
            operator: c.operator,
            value: c.value,
            caseSensitive: Boolean(c.caseSensitive),
            sortOrder: index,
          })),
        });
      }
    }

    const data: Prisma.FilterUpdateInput = {};
    if (name !== undefined) {
      data.name = name;
    }
    if (description !== undefined) {
      data.description = description;
    }
    if (enabled !== undefined) {
      data.enabled = enabled;
    }
    if (priority !== undefined) {
      data.priority = priority;
    }
    if (inboundAddressId !== undefined) {
      if (inboundAddressId === null) {
        data.inboundAddress = { disconnect: true };
      } else {
        data.inboundAddress = { connect: { id: inboundAddressId } };
      }
    }

    if (Object.keys(data).length > 0) {
      await tx.filter.updateMany({ where: { id, userId: user.id }, data });
    }
  });

  const filter = await prisma.filter.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, filter });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  try {
    const deleted = await prisma.filter.deleteMany({ where: { id, userId: user.id } });
    if (deleted.count === 0) {
      throw new Error("missing");
    }
  } catch {
    return NextResponse.json({ error: "Filtre introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
