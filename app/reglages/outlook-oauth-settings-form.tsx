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

type OutlookOAuthResponse = {
  clientId: string;
  redirectUri: string;
  tenantId: string;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  outlookPollIntervalSeconds: number;
  outlookSyncUnreadOnly: boolean;
  outlookMarkReadOnOpen: boolean;
};

export function OutlookOAuthSettingsForm() {
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [tenantId, setTenantId] = useState("common");
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
  const [outlookPollIntervalSeconds, setOutlookPollIntervalSeconds] = useState("0");
  const [outlookSyncUnreadOnly, setOutlookSyncUnreadOnly] = useState(true);
  const [outlookMarkReadOnOpen, setOutlookMarkReadOnOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicOrigin, setPublicOrigin] = useState("http://localhost:3000");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/outlook-oauth");
      const data = (await res.json()) as OutlookOAuthResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Chargement impossible.");
        return;
      }
      setClientId(data.clientId);
      setRedirectUri(data.redirectUri);
      setTenantId(data.tenantId?.trim() || "common");
      setHasClientSecret(data.hasClientSecret);
      setHasRefreshToken(data.hasRefreshToken);
      setOutlookPollIntervalSeconds(
        String(normalizeGmailPollIntervalSeconds(data.outlookPollIntervalSeconds ?? 0))
      );
      setOutlookSyncUnreadOnly(data.outlookSyncUnreadOnly !== false);
      setOutlookMarkReadOnOpen(data.outlookMarkReadOnOpen === true);
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
    const ok = searchParams.get("outlook_connected");
    const err = searchParams.get("outlook_oauth_error");
    if (ok === "1") {
      setMessage("Outlook connecte : le jeton de rafraichissement a ete enregistre en base.");
      void load();
    }
    if (err) {
      const labels: Record<string, string> = {
        no_refresh_token:
          "Microsoft n'a pas renvoye de jeton longue duree. Revoque l'app dans ton compte Microsoft puis reconnecte.",
        invalid_state: "Session OAuth expiree. Recommence la connexion.",
        not_configured: "Configure d'abord l'ID application, le secret et l'URI dans ce formulaire.",
        wrong_provider:
          "Le fournisseur boite cloud actif n'est pas Outlook. Selectionne Outlook dans la section ci-dessus.",
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
      const poll = Number.parseInt(outlookPollIntervalSeconds, 10);
      const body: Record<string, unknown> = {
        clientId: clientId.trim(),
        redirectUri: redirectUri.trim(),
        tenantId: tenantId.trim() || "common",
        outlookPollIntervalSeconds: normalizeGmailPollIntervalSeconds(poll),
        outlookSyncUnreadOnly,
        outlookMarkReadOnOpen,
      };
      if (clientSecret.trim()) {
        body.clientSecret = clientSecret.trim();
      }
      const res = await fetch("/api/settings/outlook-oauth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage("Identifiants OAuth Microsoft enregistres.");
      setClientSecret("");
      await load();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  async function clearRefreshToken() {
    if (!window.confirm("Deconnecter Outlook ? Il faudra reconnecter avec Microsoft.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/outlook-oauth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearRefreshToken: true }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erreur.");
        return;
      }
      setMessage("Connexion Outlook effacee.");
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
      const res = await fetch("/api/outlook/ping");
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
        `Microsoft Graph OK. Exemple d'IDs : ${(data.messageIds ?? []).join(", ") || "(aucun message)"}.`
      );
    } catch {
      setError("Erreur reseau.");
    }
  }

  const canConnect =
    clientId.trim() && redirectUri.trim() && (hasClientSecret || clientSecret.trim());

  const outlookRedirectExample = `${publicOrigin}/api/outlook/oauth/callback`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outlook / Microsoft (Graph)</CardTitle>
        <CardDescription>
          Inscription d&apos;une application dans le{" "}
          <a
            href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            portail Azure (Applications)
          </a>
          . Type de compte : comptes dans un annuaire organisationnel et comptes Microsoft personnels.
          URI de redirection identique ici et dans Azure (ex.{" "}
          <span className="font-mono text-xs break-all">{outlookRedirectExample}</span>
          ). Une fois Outlook connecte, les transferts partent depuis cette boite ; sinon SMTP sortant.
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
              Outlook :{" "}
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
                <Label htmlFor="o-client-id">ID d&apos;application (client)</Label>
                <Input
                  id="o-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="o-secret">
                  Secret client {hasClientSecret ? "(laisser vide pour conserver)" : ""}
                </Label>
                <Input
                  id="o-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="new-password"
                  placeholder={hasClientSecret ? "••••••••" : ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="o-tenant">Tenant (locataire)</Label>
                <Input
                  id="o-tenant"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="common"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Laisse <span className="font-mono">common</span> pour les comptes Microsoft personnels
                  et la plupart des cas multi-locataires.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="o-redirect">URI de redirection</Label>
                <Input
                  id="o-redirect"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  placeholder={outlookRedirectExample}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="o-sync-unread" className="text-foreground">
                    Importer uniquement les messages non lus
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Activé : chaque synchro ne liste que les messages encore non lus. Désactivé : la
                    boîte de réception est parcourue (nouveaux en premier, limite par passage).
                  </p>
                </div>
                <Switch
                  id="o-sync-unread"
                  checked={outlookSyncUnreadOnly}
                  onCheckedChange={(v) => setOutlookSyncUnreadOnly(v === true)}
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="o-mark-read-open" className="text-foreground">
                    Marquer comme lu sur Outlook à l&apos;ouverture
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Si activé, ouvrir un message importé depuis Outlook le marque lu côté Microsoft et
                    enregistre la date de lecture ici.
                  </p>
                </div>
                <Switch
                  id="o-mark-read-open"
                  checked={outlookMarkReadOnOpen}
                  onCheckedChange={(v) => setOutlookMarkReadOnOpen(v === true)}
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="o-poll-interval">Rafraîchissement de la boîte (Outlook)</Label>
                <Select
                  value={outlookPollIntervalSeconds}
                  onValueChange={setOutlookPollIntervalSeconds}
                >
                  <SelectTrigger id="o-poll-interval" className="w-full max-w-md">
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
                  Fréquence d&apos;appel à Microsoft Graph sur l&apos;onglet Boîte (max. 40 messages
                  par passage). Préfère des intervalles plus longs en production.
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
                    window.location.href = "/api/outlook/oauth/start";
                  }}
                >
                  Connecter Outlook
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => void runPing()}>
                  Tester Microsoft Graph
                </Button>
                {hasRefreshToken ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving}
                    onClick={() => void clearRefreshToken()}
                  >
                    Deconnecter Outlook
                  </Button>
                ) : null}
              </div>
            </form>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          Après « Enregistrer », utilise « Connecter Outlook » pour le consentement : le jeton longue
          durée est stocké en base. Secret et jetons sont sensibles : protège l&apos;accès admin et à
          la base de données.
        </p>
      </CardFooter>
    </Card>
  );
}
