"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type BoiteMarkReadOnOpenProps = {
  messageId: number;
  /** Id côté Gmail ou Microsoft Graph — déclenche l’API si le réglage est actif */
  cloudProviderMessageId: string | null;
  /** Déjà lu en base : ne rien faire */
  alreadyRead: boolean;
  /** Réglage application : marquer lu à l'ouverture (Gmail ou Outlook selon le message) */
  enabled: boolean;
};

/**
 * À l'ouverture d'un message importé depuis la boîte cloud, appelle l'API pour marquer lu côté
 * fournisseur et renseigner readAt en base (une seule fois).
 */
export function BoiteMarkReadOnOpen({
  messageId,
  cloudProviderMessageId,
  alreadyRead,
  enabled,
}: BoiteMarkReadOnOpenProps) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || alreadyRead || !cloudProviderMessageId?.trim() || ran.current) {
      return;
    }
    ran.current = true;

    void (async () => {
      const res = await fetch("/api/gmail/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = (await res.json()) as { ok?: boolean; skipped?: boolean };
      if (res.ok && data.ok) {
        router.refresh();
      }
    })();
  }, [messageId, cloudProviderMessageId, alreadyRead, enabled, router]);

  return null;
}
