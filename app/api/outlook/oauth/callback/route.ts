import { CloudMailboxProvider } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import { prisma } from "@/lib/db/prisma";
import {
  exchangeOutlookAuthCodeForTokens,
  getOutlookOAuthAppConfigFromDb,
} from "@/lib/outlook/oauth";

const STATE_COOKIE = "outlook_oauth_state";

export async function GET(request: Request) {
  const user = await getSessionUser();
  const base = new URL(request.url);

  if (!user) {
    return NextResponse.redirect(new URL("/login", base.origin));
  }

  const provider = await getActiveCloudProvider(user.id);
  if (provider !== CloudMailboxProvider.OUTLOOK) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=wrong_provider", base.origin)
    );
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/reglages?outlook_oauth_error=${encodeURIComponent(error)}`,
        base.origin
      )
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=missing_params", base.origin)
    );
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!expected || state !== expected) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=invalid_state", base.origin)
    );
  }

  const cfg = await getOutlookOAuthAppConfigFromDb(user.id);
  if (!cfg) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=not_configured", base.origin)
    );
  }

  let tokens: { refresh_token?: string };
  try {
    tokens = await exchangeOutlookAuthCodeForTokens({
      code,
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(
        `/reglages?outlook_oauth_error=${encodeURIComponent(`token_${msg.slice(0, 120)}`)}`,
        base.origin
      )
    );
  }

  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=no_refresh_token", base.origin)
    );
  }

  await prisma.outlookOAuthSettings.update({
    where: { userId: user.id },
    data: { refreshToken },
  });

  return NextResponse.redirect(new URL("/reglages?outlook_connected=1", base.origin));
}
