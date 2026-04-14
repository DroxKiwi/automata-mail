import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { validateActions, type ActionInput } from "@/lib/rules/rules-payload";
import { MergeFiltersError } from "@/lib/automation/merge-filters-for-rule";
import { createAutomationWithMaterializedRule } from "@/lib/automation/sync-materialized-rule";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const automations = await prisma.automation.findMany({
    where: { userId: user.id },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
    include: {
      filterLinks: {
        orderBy: { sortOrder: "asc" },
        include: {
          filter: { select: { id: true, name: true } },
        },
      },
      rule: { select: { id: true } },
    },
  });

  return NextResponse.json({ automations });
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
    return NextResponse.json({ error: "Nom de l automatisation requis." }, { status: 400 });
  }

  const description =
    typeof b.description === "string" ? b.description.trim() || null : null;
  const enabled = b.enabled !== false;
  const priority =
    typeof b.priority === "number" && Number.isFinite(b.priority)
      ? Math.floor(b.priority)
      : 100;
  const stopProcessing = b.stopProcessing !== false;

  const rawIds = Array.isArray(b.filterIds) ? b.filterIds : [];
  const filterIds = rawIds
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((x) => Number.isFinite(x) && x >= 1);

  if (filterIds.length === 0) {
    return NextResponse.json(
      { error: "Ajoute au moins un filtre en entree." },
      { status: 400 },
    );
  }

  const actions = Array.isArray(b.actions) ? (b.actions as ActionInput[]) : [];
  const actErr = validateActions(actions);
  if (actErr) {
    return NextResponse.json({ error: actErr }, { status: 400 });
  }

  try {
    const result = await createAutomationWithMaterializedRule({
      userId: user.id,
      name,
      description,
      enabled,
      priority,
      stopProcessing,
      filterIds,
      actions,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof MergeFiltersError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
