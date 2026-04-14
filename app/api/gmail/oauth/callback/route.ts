import { CloudMailboxProvider } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGmailOAuth2Client } from "@/lib/gmail/oauth";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import { prisma } from "@/lib/db/prisma";

const STATE_COOKIE = "gmail_oauth_state";

/**
 * Échange le code OAuth contre des jetons et enregistre le refresh_token en base.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  const base = new URL(request.url);

  if (!user) {
    return NextResponse.redirect(new URL("/login", base.origin));
  }

  const provider = await getActiveCloudProvider();
  if (provider !== CloudMailboxProvider.GOOGLE) {
    return NextResponse.redirect(
      new URL("/reglages?gmail_oauth_error=wrong_provider", base.origin)
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/reglages?gmail_oauth_error=${encodeURIComponent(error)}`, base.origin)
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/reglages?gmail_oauth_error=missing_params", base.origin)
    );
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!expected || state !== expected) {
    return NextResponse.redirect(
      new URL("/reglages?gmail_oauth_error=invalid_state", base.origin)
    );
  }

  let oauth2: Awaited<ReturnType<typeof getGmailOAuth2Client>>;
  try {
    oauth2 = await getGmailOAuth2Client();
  } catch {
    return NextResponse.redirect(
      new URL("/reglages?gmail_oauth_error=not_configured", base.origin)
    );
  }

  const { tokens } = await oauth2.getToken(code);
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    return NextResponse.redirect(
      new URL("/reglages?gmail_oauth_error=no_refresh_token", base.origin)
    );
  }

  await prisma.googleOAuthSettings.update({
    where: { id: 1 },
    data: { refreshToken },
  });

  return NextResponse.redirect(new URL("/reglages?gmail_connected=1", base.origin));
}
