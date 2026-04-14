import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGmailClientFromDb } from "@/lib/gmail/oauth";
import { prisma } from "@/lib/db/prisma";
import { getOutlookAccessTokenFromDb } from "@/lib/outlook/oauth";

export const runtime = "nodejs";

/**
 * Marque un message importé depuis la boîte cloud (Gmail ou Outlook) comme lu côté fournisseur
 * et met à jour readAt en base. Respecte les réglages gmailMarkReadOnOpen / outlookMarkReadOnOpen.
 */
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

  const messageId = Number.parseInt(String((body as { messageId?: unknown }).messageId), 10);
  if (!Number.isFinite(messageId) || messageId < 1) {
    return NextResponse.json({ error: "messageId invalide." }, { status: 400 });
  }

  const msg = await prisma.inboundMessage.findFirst({
    where: {
      id: messageId,
      inboundAddress: { isActive: true },
    },
    select: {
      id: true,
      gmailMessageId: true,
      outlookMessageId: true,
      readAt: true,
    },
  });

  if (!msg) {
    return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  }

  if (msg.readAt) {
    return NextResponse.json({ skipped: true, reason: "already_read" });
  }

  const gmailId = msg.gmailMessageId?.trim();
  const outlookId = msg.outlookMessageId?.trim();

  if (gmailId) {
    const settings = await prisma.googleOAuthSettings.findUnique({
      where: { id: 1 },
      select: { gmailMarkReadOnOpen: true },
    });
    if (settings?.gmailMarkReadOnOpen !== true) {
      return NextResponse.json({ skipped: true, reason: "disabled" });
    }
    const gmail = await getGmailClientFromDb();
    if (!gmail) {
      return NextResponse.json(
        { error: "Gmail non connecte." },
        { status: 503 }
      );
    }
    try {
      await gmail.users.messages.modify({
        userId: "me",
        id: gmailId,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    } catch (e) {
      const msgErr = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `Gmail: ${msgErr.slice(0, 200)}` },
        { status: 502 }
      );
    }
    await prisma.inboundMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (outlookId) {
    const settings = await prisma.outlookOAuthSettings.findUnique({
      where: { id: 1 },
      select: { outlookMarkReadOnOpen: true },
    });
    if (settings?.outlookMarkReadOnOpen !== true) {
      return NextResponse.json({ skipped: true, reason: "disabled" });
    }
    const token = await getOutlookAccessTokenFromDb();
    if (!token) {
      return NextResponse.json(
        { error: "Outlook non connecte." },
        { status: 503 }
      );
    }
    const patchRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(outlookId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      }
    );
    if (!patchRes.ok) {
      const t = (await patchRes.text()).slice(0, 200);
      return NextResponse.json(
        { error: `Outlook Graph: ${patchRes.status} ${t}` },
        { status: 502 }
      );
    }
    await prisma.inboundMessage.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ skipped: true, reason: "not_cloud_import" });
}
