import Link from "next/link";

import {
  boiteInboxListHref,
  type BoiteInboxPerPage,
} from "@/lib/boite/boite-messages";
import { cn } from "@/lib/utils";

type BoiteInboxFilterProps = {
  unreadOnly: boolean;
  perPage: BoiteInboxPerPage;
  hoverBordersOnly?: boolean;
};

/**
 * Filtre rapide : tous les messages ou non lus uniquement (conserve la taille de page).
 */
export function BoiteInboxFilter({
  unreadOnly,
  perPage,
  hoverBordersOnly = true,
}: BoiteInboxFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer les messages">
      <Link
        href={boiteInboxListHref({ page: 1, perPage, unreadOnly: false })}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
          !unreadOnly
            ? "bg-primary/15 text-foreground"
            : "bg-background/60 text-muted-foreground hover:text-foreground",
          hoverBordersOnly
            ? !unreadOnly
              ? "border-transparent hover:border-primary"
              : "border-transparent hover:border-border"
            : !unreadOnly
              ? "border-primary"
              : "border-transparent hover:border-border",
        )}
      >
        Tous
      </Link>
      <Link
        href={boiteInboxListHref({ page: 1, perPage, unreadOnly: true })}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
          unreadOnly
            ? "bg-primary/15 text-foreground"
            : "bg-background/60 text-muted-foreground hover:text-foreground",
          hoverBordersOnly
            ? unreadOnly
              ? "border-transparent hover:border-primary"
              : "border-transparent hover:border-border"
            : unreadOnly
              ? "border-primary"
              : "border-transparent hover:border-border",
        )}
      >
        Non lus
      </Link>
    </div>
  );
}
