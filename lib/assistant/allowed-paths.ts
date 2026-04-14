/**
 * Chemins que l’assistant peut demander d’ouvrir côté client (allowlist stricte).
 */
export function normalizeAndValidateNavigationPath(path: string): string | null {
  const raw = path.trim();
  const q = raw.indexOf("?");
  const base = (q >= 0 ? raw.slice(0, q) : raw).trim();
  if (base.length === 0 || !base.startsWith("/")) return null;
  if (base === "/boite") return "/boite";
  if (/^\/boite\/[1-9]\d*$/.test(base)) return base;
  return null;
}
