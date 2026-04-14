/** Identifiant RFC sans chevrons, pour comparaison avec les rebonds Gmail. */
export function normalizeRfcMessageId(raw: string): string {
  return raw.replace(/^<|>$/g, "").trim();
}
