import type { MailHistoryListCategory } from "@/lib/historique/mail-history-presenter";

export const HISTORIQUE_PER_PAGE_OPTIONS = [25, 50, 100] as const;
export type HistoriquePerPage = (typeof HISTORIQUE_PER_PAGE_OPTIONS)[number];

const CATEGORY_VALUES: MailHistoryListCategory[] = [
  "all",
  "reception",
  "transfert",
  "traitement",
  "synchro",
  "redaction",
  "alerte",
  "erreur",
];

export function parseHistoriqueListQuery(sp: {
  page?: string;
  perPage?: string;
  category?: string;
  automation?: string;
}): {
  page: number;
  perPage: HistoriquePerPage;
  category: MailHistoryListCategory;
  automationId: number | null;
} {
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const parsedPer = Number.parseInt(sp.perPage ?? "25", 10);
  const perPage = HISTORIQUE_PER_PAGE_OPTIONS.includes(parsedPer as HistoriquePerPage)
    ? (parsedPer as HistoriquePerPage)
    : 25;
  const raw = (sp.category ?? "all").toLowerCase();
  const category = CATEGORY_VALUES.includes(raw as MailHistoryListCategory)
    ? (raw as MailHistoryListCategory)
    : "all";
  const rawAuto = sp.automation;
  let automationId: number | null = null;
  if (rawAuto != null && rawAuto !== "" && rawAuto !== "all") {
    const n = Number.parseInt(rawAuto, 10);
    if (Number.isFinite(n) && n > 0) {
      automationId = n;
    }
  }
  return { page, perPage, category, automationId };
}

export function historiqueListHref(input: {
  page?: number;
  perPage?: number;
  category?: MailHistoryListCategory;
  automation?: number | null;
}): string {
  const p = new URLSearchParams();
  if (input.page != null && input.page > 1) {
    p.set("page", String(input.page));
  }
  if (input.perPage != null && input.perPage !== 25) {
    p.set("perPage", String(input.perPage));
  }
  if (input.category != null && input.category !== "all") {
    p.set("category", input.category);
  }
  if (input.automation != null && input.automation > 0) {
    p.set("automation", String(input.automation));
  }
  const q = p.toString();
  return q ? `/historique?${q}` : "/historique";
}
