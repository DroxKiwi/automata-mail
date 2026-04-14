import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { type ActionInput, validateActions } from "@/lib/rules/rules-payload";
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

  const rule = await prisma.rule.findFirst({
    where: { id, userId: user.id },
    include: {
      conditions: { orderBy: { id: "asc" } },
      actions: { orderBy: { order: "asc" } },
      inboundAddress: {
        select: { id: true, localPart: true, domain: true },
      },
    },
  });

  if (!rule) {
    return NextResponse.json({ error: "Regle introuvable." }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

/**
 * Remplace uniquement les actions d’une règle existante (compléter un filtre créé sans action).
 */
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

  const existing = await prisma.rule.findFirst({
    where: { id, userId: user.id },
    select: { id: true, automationId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Regle introuvable." }, { status: 404 });
  }
  if (existing.automationId != null) {
    return NextResponse.json(
      {
        error:
          "Cette regle est liee a une automatisation : modifie-la depuis l onglet Automate (formulaire d edition).",
      },
      { status: 400 },
    );
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

  const actions = (body as { actions?: ActionInput[] }).actions;
  if (!Array.isArray(actions)) {
    return NextResponse.json({ error: "Tableau actions requis." }, { status: 400 });
  }

  const actErr = validateActions(actions);
  if (actErr) {
    return NextResponse.json({ error: actErr }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.ruleAction.deleteMany({ where: { ruleId: id, rule: { userId: user.id } } });
    if (actions.length > 0) {
      await tx.ruleAction.createMany({
        data: actions.map((a) => ({
          ruleId: id,
          type: a.type,
          order: a.order,
          config: a.config as Prisma.InputJsonValue,
        })),
      });
    }
  });

  const updated = await prisma.rule.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, _count: { select: { actions: true } } },
  });

  return NextResponse.json({ ok: true, rule: updated });
}
