/** Formate la liste RCPT stockée en JSON. */
export function formatRcpt(rcpt: unknown): string {
  if (Array.isArray(rcpt)) {
    return rcpt.filter((x): x is string => typeof x === "string").join(", ");
  }
  return String(rcpt ?? "");
}

/** Libellé court type boîte mail (nom ou partie avant <…>). */
export function senderLabel(mailFrom: string): string {
  const trimmed = mailFrom.trim();
  const angle = trimmed.match(/^(.+?)\s*<[^>]+>\s*$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    if (name) return name;
  }
  const onlyEmail = trimmed.match(/<([^>]+)>/);
  if (onlyEmail) return onlyEmail[1].trim();
  return trimmed;
}

/** Aujourd’hui : heure seule ; sinon date courte. */
export function formatReceivedShort(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function previewText(textBody: string | null, maxLen = 140): string {
  const t = (textBody ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

export function headersEntries(headers: unknown): Array<{ key: string; value: string }> {
  if (headers == null || typeof headers !== "object" || Array.isArray(headers)) {
    return [];
  }
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) {
      out.push({ key: k, value: v });
    }
  }
  out.sort((a, b) => a.key.localeCompare(b.key, "fr"));
  return out;
}
