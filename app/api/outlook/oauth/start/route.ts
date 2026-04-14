import { CloudMailboxProvider } from "@prisma/client";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import {
  buildOutlookAuthorizeUrl,
  getOutlookOAuthAppConfigFromDb,
} from "@/lib/outlook/oauth";

const STATE_COOKIE = "outlook_oauth_state";
const STATE_MAX_AGE_SEC = 600;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const base = new URL(request.url);

  const provider = await getActiveCloudProvider();
  if (provider !== CloudMailboxProvider.OUTLOOK) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=wrong_provider", base.origin)
    );
  }

  const cfg = await getOutlookOAuthAppConfigFromDb();
  if (!cfg) {
    return NextResponse.redirect(
      new URL("/reglages?outlook_oauth_error=not_configured", base.origin)
    );
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

  const url = buildOutlookAuthorizeUrl({
    tenantId: cfg.tenantId,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    state,
  });

  return NextResponse.redirect(url);
}
