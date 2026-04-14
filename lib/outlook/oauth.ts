import { CloudMailboxProvider } from "@prisma/client";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import { prisma } from "@/lib/db/prisma";

/** Scopes Graph pour lire/écrire le courrier et obtenir un refresh token. */
export const OUTLOOK_OAUTH_SCOPE =
  "offline_access Mail.ReadWrite Mail.Send User.Read";

export async function getOutlookOAuthAppConfigFromDb(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId: string;
} | null> {
  const row = await prisma.outlookOAuthSettings.findUnique({
    where: { id: 1 },
  });
  if (!row) {
    return null;
  }
  const clientId = row.clientId.trim();
  const clientSecret = row.clientSecret?.trim() ?? "";
  const redirectUri = row.redirectUri.trim();
  const tenantId = row.tenantId.trim() || "common";
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri, tenantId };
}

function tokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

export async function exchangeOutlookAuthCodeForTokens(input: {
  code: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ refresh_token?: string; access_token?: string }> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    scope: OUTLOOK_OAUTH_SCOPE,
  });
  const res = await fetch(tokenEndpoint(input.tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof json.error_description === "string"
        ? json.error_description
        : typeof json.error === "string"
          ? json.error
          : res.statusText;
    throw new Error(err.slice(0, 400));
  }
  return {
    refresh_token:
      typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    access_token:
      typeof json.access_token === "string" ? json.access_token : undefined,
  };
}

/**
 * Rafraîchit un access token ; renvoie null si Outlook n’est pas le fournisseur actif
 * ou si la configuration / le refresh token manquent.
 */
export async function getOutlookAccessTokenFromDb(): Promise<string | null> {
  const provider = await getActiveCloudProvider();
  if (provider !== CloudMailboxProvider.OUTLOOK) {
    return null;
  }
  const row = await prisma.outlookOAuthSettings.findUnique({
    where: { id: 1 },
  });
  if (!row) {
    return null;
  }
  const refreshToken = row.refreshToken?.trim();
  if (!refreshToken) {
    return null;
  }
  const clientId = row.clientId.trim();
  const clientSecret = row.clientSecret?.trim() ?? "";
  const tenantId = row.tenantId.trim() || "common";
  if (!clientId || !clientSecret) {
    return null;
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: OUTLOOK_OAUTH_SCOPE,
  });
  const res = await fetch(tokenEndpoint(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== "string") {
    return null;
  }
  return json.access_token;
}

export function buildOutlookAuthorizeUrl(input: {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(
    `https://login.microsoftonline.com/${input.tenantId}/oauth2/v2.0/authorize`
  );
  u.searchParams.set("client_id", input.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("response_mode", "query");
  u.searchParams.set("scope", OUTLOOK_OAUTH_SCOPE);
  u.searchParams.set("state", input.state);
  u.searchParams.set("prompt", "consent");
  return u.toString();
}
