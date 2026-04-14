"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  GMAIL_POLL_INTERVAL_OPTIONS,
  normalizeGmailPollIntervalSeconds,
} from "@/lib/gmail/poll-interval";

type GoogleOAuthResponse = {
  clientId: string;
  redirectUri: string;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  gmailPollIntervalSeconds: number;
  gmailSyncUnreadOnly: boolean;
  gmailMarkReadOnOpen: boolean;
};

export function GoogleOAuthSettingsForm() {
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
  const [gmailPollIntervalSeconds, setGmailPollIntervalSeconds] = useState("0");
  const [gmailSyncUnreadOnly, setGmailSyncUnreadOnly] = useState(true);
  const [gmailMarkReadOnOpen, setGmailMarkReadOnOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Origine publique (BASE_URL / proxy / window) pour les exemples d’URI OAuth. */
  const [publicOrigin, setPublicOrigin] = useState("http://localhost:3000");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/google-oauth");
      const data = (await res.json()) as GoogleOAuthResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Chargement impossible.");
        return;
      }
      setClientId(data.clientId);
      setRedirectUri(data.redirectUri);
      setHasClientSecret(data.hasClientSecret);
      setHasRefreshToken(data.hasRefreshToken);
      setGmailPollIntervalSeconds(
        String(normalizeGmailPollIntervalSeconds(data.gmailPollIntervalSeconds ?? 0))
      );
      setGmailSyncUnreadOnly(data.gmailSyncUnreadOnly !== false);
      setGmailMarkReadOnOpen(data.gmailMarkReadOnOpen === true);
      setClientSecret("");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/app-origin");
        const data = (await res.json()) as { origin?: string };
        if (!cancelled && data.origin) {
          setPublicOrigin(data.origin);
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled && typeof window !== "undefined") {
        setPublicOrigin(window.location.origin);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const gmail = searchParams.get("gmail_connected");
    const err = searchParams.get("gmail_oauth_error");
    if (gmail === "1") {
      setMessage("Gmail connecte : le jeton de rafraichissement a ete enregistre en base.");
      void load();
    }
    if (err) {
      const labels: Record<string, string> = {
        no_refresh_token:
          "Google n'a pas renvoyé de jeton longue durée. Révoque l'app dans ton compte Google (applications) puis reconnecte.",
        invalid_state: "Session OAuth expiree. Recommence la connexion.",
        not_configured: "Configure d'abord l'ID client, le secret et l'URI dans ce formulaire.",
        wrong_provider:
          "Le fournisseur boite cloud actif n'est pas Gmail. Selectionne Google Gmail dans la section ci-dessus.",
      };
      setError(labels[err] ?? `Erreur OAuth : ${err}`);
    }
  }, [searchParams, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const poll = Number.parseInt(gmailPollIntervalSeconds, 10);
      const body: Record<string, unknown> = {
        clientId: clientId.trim(),
        redirectUri: redirectUri.trim(),
        gmailPollIntervalSeconds: normalizeGmailPollIntervalSeconds(poll),
        gmailSyncUnreadOnly,
        gmailMarkReadOnOpen,
      };
      if (clientSecret.trim()) {
        body.clientSecret = clientSecret.trim();
      }
      const res = await fetch("/api/settings/google-oauth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage("Identifiants OAuth enregistres.");
      setClientSecret("");
      await load();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  async function clearRefreshToken() {
    if (!window.confirm("Deconnecter Gmail ? Il faudra reconnecter avec Google.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/google-oauth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearRefreshToken: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erreur.");
        return;
      }
      setMessage("Connexion Gmail effacee.");
      await load();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  async function runPing() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/gmail/ping");
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        messageIds?: string[];
      };
      if (!res.ok) {
        setError(data.error ?? "Ping echoue.");
        return;
      }
      setMessage(
        `API Gmail OK. Exemple d'IDs : ${(data.messageIds ?? []).join(", ") || "(aucun message)"}.`
      );
    } catch {
      setError("Erreur reseau.");
    }
  }

  const canConnect =
    clientId.trim() && redirectUri.trim() && (hasClientSecret || clientSecret.trim());

  const gmailRedirectExample = `${publicOrigin}/api/gmail/oauth/callback`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail (API Google)</CardTitle>
        <CardDescription>
          Identifiants OAuth depuis la{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            console Google Cloud
          </a>
          . L&apos;URI de redirection doit etre identique ici et dans la console (ex.{" "}
          <span className="font-mono text-xs break-all">{gmailRedirectExample}</span>
          ). Une fois Gmail connecte, les transferts (raccourcis et regles FORWARD) sont envoyes
          depuis cette boite ; sinon l&apos;envoi utilise le SMTP sortant des Reglages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
              role="status"
            >
              Gmail :{" "}
              <strong className="text-foreground">
                {hasRefreshToken ? "connecte (jeton en base)" : "non connecte"}
              </strong>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </div>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="g-client-id">ID client OAuth</Label>
                <Input
                  id="g-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxx.apps.googleusercontent.com"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="g-secret">Secret client {hasClientSecret ? "(laisser vide pour conserver)" : ""}</Label>
                <Input
                  id="g-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="new-password"
                  placeholder={hasClientSecret ? "••••••••" : ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="g-redirect">URI de redirection</Label>
                <Input
                  id="g-redirect"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  placeholder={gmailRedirectExample}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="g-sync-unread" className="text-foreground">
                    Importer uniquement les messages non lus
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Activé : chaque synchro ne liste que les fils encore non lus (charge réduite).
                    Désactivé : la boîte de réception complète est parcourue (nouveaux en premier,
                    même limite par passage).
                  </p>
                </div>
                <Switch
                  id="g-sync-unread"
                  checked={gmailSyncUnreadOnly}
                  onCheckedChange={(v) => setGmailSyncUnreadOnly(v === true)}
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="g-mark-read-open" className="text-foreground">
                    Marquer comme lu sur Gmail à l&apos;ouverture
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Si activé, ouvrir un message importé depuis Gmail retire le libellé « non lu »
                    côté Google et enregistre la date de lecture ici.
                  </p>
                </div>
                <Switch
                  id="g-mark-read-open"
                  checked={gmailMarkReadOnOpen}
                  onCheckedChange={(v) => setGmailMarkReadOnOpen(v === true)}
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="g-poll-interval">Rafraîchissement de la boîte (Gmail)</Label>
                <Select
                  value={gmailPollIntervalSeconds}
                  onValueChange={setGmailPollIntervalSeconds}
                >
                  <SelectTrigger id="g-poll-interval" className="w-full max-w-md">
                    <SelectValue placeholder="Choisir un intervalle" />
                  </SelectTrigger>
                  <SelectContent>
                    {GMAIL_POLL_INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Fréquence d&apos;appel à l&apos;API Gmail sur l&apos;onglet Boîte (max. 40 messages
                  par passage, selon les options ci-dessus). Un intervalle court augmente la charge ;
                  en production, privilégie plutôt 1 à 5 minutes.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving || !canConnect}
                  onClick={() => {
                    window.location.href = "/api/gmail/oauth/start";
                  }}
                >
                  Connecter Gmail
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => void runPing()}>
                  Tester l&apos;API Gmail
                </Button>
                {hasRefreshToken ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving}
                    onClick={() => void clearRefreshToken()}
                  >
                    Deconnecter Gmail
                  </Button>
                ) : null}
              </div>
            </form>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          Apres « Enregistrer », utilise « Connecter Gmail » pour autoriser l&apos;application : le
          jeton longue durée est stocke en base. Le secret client et les jetons sont sensibles :
          protege l&apos;acces a l&apos;admin et a la base de donnees.
        </p>
      </CardFooter>
    </Card>
  );
}
