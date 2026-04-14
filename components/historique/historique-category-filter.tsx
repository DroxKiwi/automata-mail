import Link from "next/link";

import type { MailHistoryListCategory } from "@/lib/historique/mail-history-presenter";
import { historiqueListHref, type HistoriquePerPage } from "@/lib/historique/historique-list-query";
import { cn } from "@/lib/utils";

const FILTER_ITEMS: { value: MailHistoryListCategory; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "reception", label: "Réception" },
  { value: "transfert", label: "Transfert / envoi" },
  { value: "traitement", label: "Traitement (règles)" },
  { value: "synchro", label: "Synchro boîte" },
  { value: "redaction", label: "Rédaction" },
  { value: "alerte", label: "Alerte" },
  { value: "erreur", label: "Erreur" },
];

type HistoriqueCategoryFilterProps = {
  current: MailHistoryListCategory;
  perPage: HistoriquePerPage;
  automationId?: number | null;
};

/**
 * Liens de filtre par catégorie (réinitialise la page à 1).
 */
export function HistoriqueCategoryFilter({
  current,
  perPage,
  automationId,
}: HistoriqueCategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par type">
      {FILTER_ITEMS.map(({ value, label }) => {
        const active = current === value;
        return (
          <Link
            key={value}
            href={historiqueListHref({
              page: 1,
              perPage,
              category: value,
              automation: automationId ?? undefined,
            })}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
              active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-transparent bg-background/60 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
