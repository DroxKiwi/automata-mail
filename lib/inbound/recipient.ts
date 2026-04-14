/**
 * Extrait local@domaine depuis une adresse SMTP (avec ou sans chevrons).
 */
export function parseSmtpAddress(addr: string): {
  localPart: string;
  domain: string;
} | null {
  const trimmed = addr.trim();
  const angle = trimmed.match(/^<([^>]+)>$/);
  const core = (angle ? angle[1] : trimmed).trim();
  const at = core.lastIndexOf("@");
  if (at <= 0 || at === core.length - 1) {
    return null;
  }
  const localPart = core.slice(0, at).trim();
  const domain = core.slice(at + 1).trim().toLowerCase();
  if (!localPart || !domain) {
    return null;
  }
  return { localPart, domain };
}
