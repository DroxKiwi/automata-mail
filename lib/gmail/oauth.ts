import { CloudMailboxProvider } from "@prisma/client";
import { google } from "googleapis";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import { prisma } from "@/lib/db/prisma";

/** Lire, envoyer, modifier les libellés (lu, etc.). */
export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
] as const;

export async function getGmailOAuth2ConfigFromDb(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null> {
  const row = await prisma.googleOAuthSettings.findUnique({
    where: { id: 1 },
  });
  if (!row) {
    return null;
  }
  const clientId = row.clientId.trim();
  const clientSecret = row.clientSecret?.trim() ?? "";
  const redirectUri = row.redirectUri.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Client OAuth2 Google configuré depuis la base (Réglages).
 */
export async function getGmailOAuth2Client() {
  const cfg = await getGmailOAuth2ConfigFromDb();
  if (!cfg) {
    throw new Error(
      "Gmail OAuth non configure : renseigne l'ID client, le secret et l'URI de redirection dans Reglages."
    );
  }
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

/**
 * Client Gmail API avec refresh token stocké en base.
 */
export async function getGmailClientFromDb() {
  const provider = await getActiveCloudProvider();
  if (provider !== CloudMailboxProvider.GOOGLE) {
    return null;
  }
  const row = await prisma.googleOAuthSettings.findUnique({
    where: { id: 1 },
    select: { refreshToken: true },
  });
  const refreshToken = row?.refreshToken?.trim();
  if (!refreshToken) {
    return null;
  }
  const oauth2 = await getGmailOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2 });
}
