import { headers } from "next/headers";

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    const t = v?.trim();
    if (t) {
      return t;
    }
  }
  return undefined;
}

/**
 * Origine publique de l’app (schéma + hôte, sans chemin), pour OAuth et textes d’aide.
 *
 * Ordre :
 * 1. `BASE_URL` (ex. https://mail.exemple.fr) — priorité prod / Docker
 * 2. `APP_BASE_URL` ou `NEXT_PUBLIC_APP_URL`
 * 3. En-têtes `x-forwarded-host` / `host` + `x-forwarded-proto` (reverse proxy)
 * 4. Défaut dev : http://localhost:3000
 *
 * À utiliser uniquement côté serveur (Route Handler, Server Component).
 */
export async function resolvePublicAppOrigin(): Promise<string> {
  const explicit = firstNonEmpty(
    process.env.BASE_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  );
  if (explicit) {
    return normalizeOrigin(explicit);
  }

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = firstNonEmpty(forwardedHost, h.get("host") ?? undefined);
  if (host) {
    const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    const proto =
      forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
    return normalizeOrigin(`${proto}://${host}`);
  }

  return "http://localhost:3000";
}
