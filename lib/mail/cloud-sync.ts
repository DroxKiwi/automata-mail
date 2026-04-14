import { CloudMailboxProvider } from "@prisma/client";
import { syncGmailToBoite } from "@/lib/gmail/sync-inbox";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import { syncOutlookToBoite } from "@/lib/outlook/sync-inbox";

export type CloudSyncResult =
  | {
      ok: true;
      provider: CloudMailboxProvider;
      imported: number;
      skippedAlready: number;
      fetchErrors: number;
    }
  | { ok: false; error: string };

/**
 * Synchronise la boîte cloud selon le fournisseur actif (Réglages).
 */
export async function runCloudInboxSync(): Promise<CloudSyncResult> {
  const provider = await getActiveCloudProvider();
  if (provider === CloudMailboxProvider.GOOGLE) {
    const r = await syncGmailToBoite();
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    return {
      ok: true,
      provider,
      imported: r.imported,
      skippedAlready: r.skippedAlready,
      fetchErrors: r.fetchErrors,
    };
  }
  if (provider === CloudMailboxProvider.OUTLOOK) {
    const r = await syncOutlookToBoite();
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    return {
      ok: true,
      provider,
      imported: r.imported,
      skippedAlready: r.skippedAlready,
      fetchErrors: r.fetchErrors,
    };
  }
  return {
    ok: false,
    error:
      "Aucune boite cloud active : choisis Google Gmail ou Outlook Microsoft dans Reglages.",
  };
}
