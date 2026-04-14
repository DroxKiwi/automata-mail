import { NextResponse } from "next/server";
import { getSessionUser } from "./auth-user";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

type RequireAdminResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

/** Réponse JSON 401 / 403 ou utilisateur admin pour les routes API. */
export async function requireAdminApiUser(): Promise<RequireAdminResult> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non authentifie." }, { status: 401 }),
    };
  }
  if (!user.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acces refuse." }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
