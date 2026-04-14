"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoogleOAuthSettingsForm } from "./google-oauth-settings-form";
import { OutlookOAuthSettingsForm } from "./outlook-oauth-settings-form";

type CloudProvider = "NONE" | "GOOGLE" | "OUTLOOK";

export function CloudMailboxSettings() {
  const [activeProvider, setActiveProvider] = useState<CloudProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<CloudProvider | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/mailbox-provider");
      const data = (await res.json()) as {
        activeProvider?: CloudProvider;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Chargement du fournisseur impossible.");
        return;
      }
      setActiveProvider(data.activeProvider ?? "NONE");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function requiresWipe(from: CloudProvider, to: CloudProvider): boolean {
    if (from === to) return false;
    if (from === "NONE" || to === "NONE") return false;
    return from !== to;
  }

  async function applyProvider(next: CloudProvider, confirmWipe: boolean) {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/mailbox-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: next === "GOOGLE" ? "GOOGLE" : "OUTLOOK",
          confirmWipe,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        activeProvider?: CloudProvider;
      };
      if (!res.ok) {
        if (data.code === "CONFIRM_WIPE_REQUIRED") {
          setPendingProvider(next);
          setDialogOpen(true);
          return;
        }
        setError(data.error ?? "Mise a jour impossible.");
        return;
      }
      setActiveProvider(data.activeProvider ?? next);
      setDialogOpen(false);
      setPendingProvider(null);
      window.location.reload();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setApplying(false);
    }
  }

  function onChooseProvider(next: CloudProvider) {
    if (activeProvider === null || next === activeProvider) {
      return;
    }
    const wipe = requiresWipe(activeProvider, next);
    if (wipe) {
      setPendingProvider(next);
      setDialogOpen(true);
      return;
    }
    void applyProvider(next, false);
  }

  async function confirmDialog() {
    if (!pendingProvider) return;
    await applyProvider(pendingProvider, true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Boite mail cloud</CardTitle>
          <CardDescription>
            Choisis un seul connecteur : <strong>Google Gmail</strong> ou{" "}
            <strong>Outlook / Microsoft</strong> (Microsoft Graph). Les transferts et la synchro de
            la boîte utilisent ce compte lorsqu&apos;il est connecté ; sinon l&apos;envoi passe par le
            SMTP sortant des réglages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement du fournisseur…</p>
          ) : (
            <>
              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}

              <div
                className="flex flex-col gap-4 sm:flex-row sm:items-start"
                role="radiogroup"
                aria-label="Fournisseur de boite cloud"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input
                    type="radio"
                    name="cloud-provider"
                    className="mt-1"
                    checked={activeProvider === "GOOGLE"}
                    onChange={() => onChooseProvider("GOOGLE")}
                    disabled={applying}
                  />
                  <span>
                    <span className="font-medium text-foreground">Google Gmail</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      API Gmail (Google Cloud Console).
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input
                    type="radio"
                    name="cloud-provider"
                    className="mt-1"
                    checked={activeProvider === "OUTLOOK"}
                    onChange={() => onChooseProvider("OUTLOOK")}
                    disabled={applying}
                  />
                  <span>
                    <span className="font-medium text-foreground">Outlook / Microsoft</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Microsoft Graph (inscription Azure / Entra ID).
                    </span>
                  </span>
                </label>
              </div>

              {activeProvider === "NONE" ? (
                <p className="text-sm text-muted-foreground">
                  Aucun fournisseur sélectionné : choisis Gmail ou Outlook pour afficher la
                  configuration OAuth correspondante.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {activeProvider === "GOOGLE" ? <GoogleOAuthSettingsForm /> : null}
      {activeProvider === "OUTLOOK" ? <OutlookOAuthSettingsForm /> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showClose={!applying}>
          <DialogHeader>
            <DialogTitle>Changer de fournisseur de boîte ?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  En confirmant, <strong className="text-foreground">toutes les données mail</strong>{" "}
                  stockées dans cette application seront supprimées : messages reçus importés,
                  pièces jointes en base, journaux d&apos;actions liés et journal de flux mail.
                </p>
                <p>
                  Les connexions OAuth Gmail et Outlook seront réinitialisées : tu devras reconnecter
                  le compte du nouveau fournisseur. Les API ne sont pas les mêmes : on repart sur une
                  base vide côté app.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={applying}
              onClick={() => {
                setDialogOpen(false);
                setPendingProvider(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={applying}
              onClick={() => void confirmDialog()}
            >
              {applying ? "Application…" : "Confirmer et tout effacer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
