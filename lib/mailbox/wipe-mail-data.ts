import { prisma } from "@/lib/db/prisma";

/**
 * Supprime tout l’historique mail côté app (messages entrants, pièces jointes, journaux d’actions)
 * et le journal MailFlowEvent. Utilisé lors d’un changement de fournisseur cloud (Gmail ↔ Outlook).
 */
export async function wipeAllMailAppData(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.mailFlowEvent.deleteMany({});
    await tx.inboundMessage.deleteMany({});
  });
}
