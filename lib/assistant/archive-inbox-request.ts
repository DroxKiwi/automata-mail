import { prisma } from "@/lib/db/prisma";
import { createPendingMutation } from "@/lib/assistant/pending-mutations";

export type ArchiveRequestResult =
  | {
      ok: true;
      mustConfirm: true;
      token: string;
      summary: string;
      expiresInMinutes: number;
    }
  | { ok: false; error: string };

/**
 * Prépare une archive : pas d’UPDATE tant que l’humain n’a pas confirmé le jeton.
 */
export async function requestArchiveInboxMessage(input: {
  userId: number;
  messageId: number;
}): Promise<ArchiveRequestResult> {
  const row = await prisma.inboundMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, subject: true, mailFrom: true, archived: true },
  });

  if (!row) {
    return { ok: false, error: "Message not found." };
  }

  const subject = row.subject?.trim() || "(sans sujet)";
  const summary = `Archiver le message #${row.id} — ${subject} — de ${row.mailFrom}${row.archived ? " (déjà archivé : la confirmation ne changera rien d’autre que valider l’intention)" : ""}.`;

  const token = createPendingMutation({
    userId: input.userId,
    kind: "archive_inbox_message",
    messageId: row.id,
  });

  return {
    ok: true,
    mustConfirm: true,
    token,
    summary,
    expiresInMinutes: 10,
  };
}

export async function applyArchiveInboxMessage(messageId: number): Promise<{
  ok: true;
  archived: boolean;
} | { ok: false; error: string }> {
  try {
    await prisma.inboundMessage.update({
      where: { id: messageId },
      data: { archived: true },
    });
    return { ok: true, archived: true };
  } catch {
    return { ok: false, error: "Update failed (message not found?)." };
  }
}
