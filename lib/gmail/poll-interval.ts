/** Intervalles autorisés (secondes) pour la synchro Gmail sur la boîte de réception. */
export const GMAIL_POLL_INTERVAL_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 0, label: "Désactivé (synchro manuelle sur la boîte)" },
  { value: 10, label: "10 secondes" },
  { value: 30, label: "30 secondes" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 heure" },
];

const ALLOWED = new Set(GMAIL_POLL_INTERVAL_OPTIONS.map((o) => o.value));

export function isAllowedGmailPollIntervalSeconds(n: number): boolean {
  return ALLOWED.has(n);
}

/** Si une ancienne valeur en base n’est plus dans la liste, on prend l’entrée la plus proche. */
export function normalizeGmailPollIntervalSeconds(n: number): number {
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  const rounded = Math.floor(n);
  if (ALLOWED.has(rounded)) {
    return rounded;
  }
  const sorted = [...ALLOWED].sort((a, b) => a - b);
  let best = sorted[0]!;
  let bestDist = Math.abs(rounded - best);
  for (const v of sorted) {
    const d = Math.abs(rounded - v);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}
