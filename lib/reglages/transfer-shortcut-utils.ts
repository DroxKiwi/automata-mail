/** Normalise une adresse pour stockage / comparaison (trim + minuscules). */
export function normalizeTransferEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmailShape(s: string): boolean {
  const v = s.trim();
  if (v.length < 3 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Dédoublonne une liste déjà normalisée (ordre conservé). */
export function dedupeNormalizedEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

/** Extrait des adresses depuis du texte (lignes, virgules, points-virgules). */
export function parseEmailsFromText(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((s) => normalizeTransferEmail(s))
    .filter(Boolean);
  return dedupeNormalizedEmails(parts);
}

/** Valide une liste destinée à un raccourci ; retourne un message d’erreur ou null. */
export function validateDestinataireList(emails: string[]): string | null {
  if (emails.length === 0) {
    return "Ajoutez au moins une adresse e-mail.";
  }
  for (const e of emails) {
    if (!isValidEmailShape(e)) {
      return `Adresse invalide : ${e}`;
    }
  }
  return null;
}

/** Normalise un tableau d’adresses (saisie API JSON). */
export function normalizeEmailArrayInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parts = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => normalizeTransferEmail(s))
    .filter(Boolean);
  return dedupeNormalizedEmails(parts);
}
