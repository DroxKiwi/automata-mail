import type { Prisma } from "@prisma/client";
import { ActionLogStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendForwardMail } from "@/lib/inbound/smtp-send";
import { mailFlowLogSafe } from "@/lib/mail/mail-flow-log";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { id: raw } = await context.params;
  const messageId = Number.parseInt(raw, 10);
  if (!Number.isFinite(messageId) || messageId < 1) {
    return NextResponse.json({ error: "ID invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const shortcutIdRaw =
    typeof body === "object" &&
    body !== null &&
    "shortcutId" in body &&
    typeof (body as { shortcutId: unknown }).shortcutId === "number"
      ? (body as { shortcutId: number }).shortcutId
      : typeof body === "object" &&
          body !== null &&
          "shortcutId" in body &&
          typeof (body as { shortcutId: unknown }).shortcutId === "string"
        ? Number.parseInt((body as { shortcutId: string }).shortcutId, 10)
        : NaN;

  if (!Number.isFinite(shortcutIdRaw) || shortcutIdRaw < 1) {
    return NextResponse.json({ error: "Raccourci invalide." }, { status: 400 });
  }

  const shortcut = await prisma.transferShortcut.findFirst({
    where: { id: shortcutIdRaw, userId: user.id },
    select: { id: true, emails: true },
  });

  if (!shortcut || shortcut.emails.length === 0) {
    return NextResponse.json({ error: "Raccourci introuvable." }, { status: 404 });
  }

  const message = await prisma.inboundMessage.findFirst({
    where: {
      id: messageId,
      userId: user.id,
      inboundAddress: { isActive: true },
    },
    select: {
      id: true,
      mailFrom: true,
      subject: true,
      textBody: true,
      htmlBody: true,
      correlationId: true,
    },
  });

  if (!message) {
    return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  }

  const toList = shortcut.emails;
  const correlationId =
    message.correlationId?.trim() ||
    `shortcut-forward:${message.id}:${randomUUID()}`;

  try {
    const sendResult = await sendForwardMail(user.id, {
      to: toList,
      subject: message.subject?.trim() || "(sans sujet)",
      text: message.textBody ?? undefined,
      html: message.htmlBody ?? undefined,
      replyTo: message.mailFrom,
    });
    const detail: Record<string, unknown> = {
      type: "FORWARD",
      to: toList,
      shortcutId: shortcut.id,
      source: "shortcut",
    };
    if (sendResult.channel === "gmail") {
      detail.outboundRfcMessageId = sendResult.outboundRfcMessageId;
      detail.gmailSentMessageId = sendResult.gmailSentMessageId;
    }
    if (sendResult.channel === "outlook") {
      detail.outboundRfcMessageId = sendResult.outboundRfcMessageId;
      detail.outlookSentMessageId = sendResult.outlookSentMessageId;
    }

    await prisma.messageActionLog.create({
      data: {
        inboundMessageId: message.id,
        ruleId: null,
        actionId: null,
        status: ActionLogStatus.SENT,
        detail: detail as Prisma.InputJsonValue,
      },
    });

    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "ui_transfer_shortcut_sent",
      direction: "out",
      summary: `Transfert manuel vers ${toList.join(", ")} (raccourci #${shortcut.id}, message #${message.id})`,
      detail: {
        inboundMessageId: message.id,
        shortcutId: shortcut.id,
        to: toList,
        subject: message.subject,
      },
    });

    await prisma.inboundMessage.updateMany({
      where: { id: message.id, userId: user.id },
      data: { archived: true },
    });

    return NextResponse.json({ ok: true, to: toList, shortcutId: shortcut.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur envoi";
    await mailFlowLogSafe({
      correlationId,
      actor: "next",
      step: "ui_transfer_shortcut_failed",
      direction: "out",
      summary: `Échec transfert manuel (message #${message.id}) : ${msg.slice(0, 200)}`,
      detail: {
        inboundMessageId: message.id,
        shortcutId: shortcut.id,
        to: toList,
        error: msg,
      },
    });
    await prisma.messageActionLog.create({
      data: {
        inboundMessageId: message.id,
        ruleId: null,
        actionId: null,
        status: ActionLogStatus.FAILED,
        detail: {
          type: "FORWARD",
          to: toList,
          shortcutId: shortcut.id,
          source: "shortcut",
          error: msg,
        },
      },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
