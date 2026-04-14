import libmime from "libmime";

type GmailHeader = { name?: string | null; value?: string | null };

/**
 * Expéditeur fiable depuis l’API Gmail (`messages.get` format metadata ou full) :
 * en-têtes `From` / `Sender` / `Reply-To`, avec décodage des mots encodés RFC 2047.
 */
export function resolveMailFromFromGmailApiHeaders(
  headers: GmailHeader[] | undefined,
): string | null {
  if (!headers?.length) {
    return null;
  }

  const get = (key: string) =>
    headers.find((h) => (h.name || "").toLowerCase() === key.toLowerCase())?.value?.trim();

  for (const key of ["from", "sender", "reply-to"] as const) {
    const raw = get(key);
    if (!raw) {
      continue;
    }
    try {
      return libmime.decodeWords(raw);
    } catch {
      return raw;
    }
  }

  return null;
}
