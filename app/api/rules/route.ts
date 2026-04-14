import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import {
  type ActionInput,
  type ConditionInput,
  validateActions,
  validateConditions,
} from "@/lib/rules/rules-payload";
import { prisma } from "@/lib/db/prisma";

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

  const filterIdRaw = b.filterId;
  const filterIdNum =
    filterIdRaw != null && filterIdRaw !== ""
      ? Number(filterIdRaw)
      : NaN;
  const hasFilterId = Number.isFinite(filterIdNum) && filterIdNum >= 1;

  if (hasFilterId) {
    const filter = await prisma.filter.findUnique({
      where: { id: filterIdNum },
      include: { conditions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!filter) {
      return NextResponse.json({ error: "Filtre introuvable." }, { status: 404 });
    }
    if (filter.conditions.length === 0) {
      return NextResponse.json(
        { error: "Ce filtre n a pas de conditions." },
        { status: 400 },
      );
    }

    const rawActions = Array.isArray(b.actions) ? (b.actions as ActionInput[]) : [];
    if (rawActions.length === 0) {
      return NextResponse.json(
        { error: "Ajoute au moins une action." },
        { status: 400 },
      );
    }
    const actErr = validateActions(rawActions);
    if (actErr) {
      return NextResponse.json({ error: actErr }, { status: 400 });
    }

    const nameFromBody = typeof b.name === "string" ? b.name.trim() : "";
    const name = nameFromBody || filter.name;

    const enabled = b.enabled !== false && filter.enabled;
    const priority =
      typeof b.priority === "number" && Number.isFinite(b.priority)
        ? Math.floor(b.priority)
        : filter.priority;
    const stopProcessing = b.stopProcessing !== false;

    const conditionCreates: Prisma.RuleConditionCreateWithoutRuleInput[] =
      filter.conditions.map((c) => ({
        field: c.field,
        headerName:
          c.field === "HEADER" ? (c.headerName ?? "").trim() || null : null,
        operator: c.operator,
        value: c.value,
        caseSensitive: Boolean(c.caseSensitive),
      }));

    const actionCreates: Prisma.RuleActionCreateWithoutRuleInput[] =
      rawActions.map((a) => ({
        type: a.type,
        order: a.order,
        config: a.config as Prisma.InputJsonValue,
      }));

    const rule = await prisma.rule.create({
      data: {
        inboundAddressId: filter.inboundAddressId,
        name,
        enabled,
        priority,
        stopProcessing,
        conditions: { create: conditionCreates },
        actions: { create: actionCreates },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({ ok: true, rule });
  }

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nom de la regle requis." }, { status: 400 });
  }

  const enabled = b.enabled !== false;
  const priority =
    typeof b.priority === "number" && Number.isFinite(b.priority)
      ? Math.floor(b.priority)
      : 100;
  const stopProcessing = b.stopProcessing !== false;
  const allowEmptyActions = b.allowEmptyActions === true;

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

  const rawActions = Array.isArray(b.actions) ? (b.actions as ActionInput[]) : [];
  if (rawActions.length === 0 && !allowEmptyActions) {
    return NextResponse.json(
      { error: "Ajoute au moins une action." },
      { status: 400 },
    );
  }
  const actErr = rawActions.length > 0 ? validateActions(rawActions) : null;
  if (actErr) {
    return NextResponse.json({ error: actErr }, { status: 400 });
  }

  const conditionCreates: Prisma.RuleConditionCreateWithoutRuleInput[] =
    conditions.map((c) => ({
      field: c.field,
      headerName:
        c.field === "HEADER" ? (c.headerName ?? "").trim() || null : null,
      operator: c.operator,
      value: c.value,
      caseSensitive: Boolean(c.caseSensitive),
    }));

  const actionCreates: Prisma.RuleActionCreateWithoutRuleInput[] =
    rawActions.map((a) => ({
      type: a.type,
      order: a.order,
      config: a.config as Prisma.InputJsonValue,
    }));

  const rule = await prisma.rule.create({
    data: {
      inboundAddressId,
      name,
      enabled,
      priority,
      stopProcessing,
      conditions: { create: conditionCreates },
      actions: { create: actionCreates },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, rule });
}
