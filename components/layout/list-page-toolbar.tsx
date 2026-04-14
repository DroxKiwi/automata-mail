import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ListPageToolbarPerPage = {
  value: number;
  options: readonly number[];
  /** Lien pour afficher `n` éléments par page (souvent page 1). */
  hrefForPerPage: (n: number) => string;
};

export type ListPageToolbarPagination = {
  page: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
  perPage: ListPageToolbarPerPage;
};

export type ListPageToolbarProps = {
  /** Résumé du jeu courant, ex. « 1–50 sur 200 messages » */
  rangeLabel: string;
  /** Filtres (liens, badges, etc.) — rendus au centre sur grand écran */
  filterSlot?: ReactNode;
  /** Pagination (précédent / suivant / taille de page) */
  pagination: ListPageToolbarPagination;
  /** Libellé accessibilité pour la zone pagination */
  paginationAriaLabel?: string;
  className?: string;
};

/**
 * Barre réutilisable : résumé + filtres + pagination, pensée pour le bandeau sous le titre (header).
 */
export function ListPageToolbar({
  rangeLabel,
  filterSlot,
  pagination,
  paginationAriaLabel = "Pagination",
  className,
}: ListPageToolbarProps) {
  const { page, totalPages, prevHref, nextHref, perPage } = pagination;
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-muted/25 px-3 py-3 shadow-xs md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:gap-y-2",
        className,
      )}
    >
      <p className="shrink-0 text-sm text-muted-foreground md:max-w-[min(100%,20rem)]">
        {rangeLabel}
      </p>

      {filterSlot ? (
        <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-center">
          {filterSlot}
        </div>
      ) : null}

      <nav
        className="flex flex-wrap items-center gap-3 md:shrink-0 md:justify-end"
        aria-label={paginationAriaLabel}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground sm:text-sm">Par page</span>
          <div className="inline-flex rounded-md border border-border bg-background/80 p-0.5">
            {perPage.options.map((n) => (
              <Link
                key={n}
                href={perPage.hrefForPerPage(n)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
                  perPage.value === n
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {prevHref ? (
            <Link
              href={prevHref}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Précédent
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground">
              Précédent
            </span>
          )}
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
            Page {safePage} / {totalPages}
          </span>
          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Suivant
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground">
              Suivant
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
