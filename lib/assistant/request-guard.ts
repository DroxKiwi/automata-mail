/**
 * Réduit l’usage de l’assistant depuis d’autres origines (session toujours requise en plus).
 * Si le navigateur envoie `Origin`, il doit correspondre à `Host`.
 */
export function assistantRequestOriginError(request: Request): string | null {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (!host || u.host !== host) {
      return "Requete refusee : origine incorrecte.";
    }
  } catch {
    return "Requete refusee : origine invalide.";
  }
  return null;
}
