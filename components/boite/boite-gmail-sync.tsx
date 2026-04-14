"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type CloudProvider = "NONE" | "GOOGLE" | "OUTLOOK";

type BoiteCloudSyncProps = {
  pollIntervalSeconds: number;
  cloudConnected: boolean;
  /** false = import de toute la boîte (réglages du fournisseur actif) */
  syncUnreadOnly: boolean;
  activeCloudProvider: CloudProvider;
};

export function BoiteGmailSync({
  pollIntervalSeconds,
  cloudConnected,
  syncUnreadOnly,
  activeCloudProvider,
}: BoiteCloudSyncProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  const runSync = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSyncing(true);
    try {
      const res = await fetch("/api/mail/cloud-sync", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [router]);

  const initialSyncDone = useRef(false);

  useEffect(() => {
    if (!cloudConnected || pollIntervalSeconds <= 0) {
      return;
    }
    if (initialSyncDone.current) {
      return;
    }
    initialSyncDone.current = true;
    void runSync();
  }, [cloudConnected, pollIntervalSeconds, runSync]);

  useEffect(() => {
    if (!cloudConnected || pollIntervalSeconds <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      void runSync();
    }, pollIntervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [cloudConnected, pollIntervalSeconds, runSync]);

  if (activeCloudProvider === "NONE") {
    return (
      <p className="text-xs text-muted-foreground">
        Choisis Gmail ou Outlook comme boite cloud dans Reglages pour activer la synchro ici.
      </p>
    );
  }

  if (!cloudConnected) {
    const hint =
      activeCloudProvider === "GOOGLE"
        ? "Connecte Gmail dans Reglages pour synchroniser ta boite Google ici."
        : "Connecte Outlook dans Reglages pour synchroniser ta boite Microsoft ici.";
    return <p className="text-xs text-muted-foreground">{hint}</p>;
  }

  const providerLabel =
    activeCloudProvider === "GOOGLE" ? "Gmail" : "Outlook / Microsoft";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {pollIntervalSeconds > 0 ? (
        <span>
          Synchro {providerLabel} : toutes les {pollIntervalSeconds} s (
          {syncUnreadOnly ? (
            <>
              <strong>non lus</strong> uniquement
            </>
          ) : (
            <>
              <strong>toute la boîte</strong> (nouveaux en premier)
            </>
          )}
          , max. 40 par passage). {syncing ? "Synchronisation en cours…" : null}
        </span>
      ) : (
        <>
          <span>Pas de synchro automatique (regle l&apos;intervalle dans Reglages).</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? "Synchronisation…" : `Synchroniser (${providerLabel})`}
          </Button>
        </>
      )}
    </div>
  );
}
