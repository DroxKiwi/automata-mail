import { CloudMailboxProvider } from "@prisma/client";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  GMAIL_OAUTH_SCOPES,
  getGmailOAuth2Client,
} from "@/lib/gmail/oauth";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";

const STATE_COOKIE = "gmail_oauth_state";
const STATE_MAX_AGE_SEC = 600;

/**
 * Démarre le flux OAuth Google : redirection vers le consentement.
 * Prérequis : identifiants OAuth renseignés dans Reglages (base de données).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const base = new URL(request.url);

  const provider = await getActiveCloudProvider(user.id);
  if (provider !== CloudMailboxProvider.GOOGLE) {
    return NextResponse.redirect(
      new URL("/reglages?gmail_oauth_error=wrong_provider", base.origin)
    );
  }

  let oauth2: Awaited<ReturnType<typeof getGmailOAuth2Client>>;
  try {
    oauth2 = await getGmailOAuth2Client(user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    path: "/",
    maxAge: STATE_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GMAIL_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url);
}
