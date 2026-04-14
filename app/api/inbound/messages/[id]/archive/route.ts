import type { Prisma } from "@prisma/client";
import { ActionLogStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";

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
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("archived" in body)
  ) {
    return NextResponse.json(
      { error: "Champ boolean archived requis." },
      { status: 400 },
    );
  }

  const archived = Boolean((body as { archived: unknown }).archived);

  const existing = await prisma.inboundMessage.findFirst({
    where: {
      id,
      inboundAddress: { isActive: true },
    },
    select: { id: true, archived: true, correlationId: true, subject: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  }

  await prisma.inboundMessage.update({
    where: { id },
    data: { archived },
  });

  if (archived && !existing.archived) {
    const correlationId =
      existing.correlationId?.trim() || `ui-archive:${existing.id}`;
    await prisma.messageActionLog.create({
      data: {
        inboundMessageId: id,
        ruleId: null,
        actionId: null,
        status: ActionLogStatus.SENT,
        detail: { type: "UI_ARCHIVE" } as Prisma.InputJsonValue,
      },
    });
    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "ui_message_archived_manual",
      direction: "in",
      summary: `Message #${id} archivé manuellement depuis la boîte`,
      detail: {
        inboundMessageId: id,
        subject: existing.subject,
      },
    });
  }

  return NextResponse.json({ ok: true, archived });
}
