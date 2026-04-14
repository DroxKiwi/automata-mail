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
  /** Si true, les bordures sont visibles uniquement au hover. */
  hoverBordersOnly?: boolean;
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
  hoverBordersOnly = true,
}: ListPageToolbarProps) {
  const { page, totalPages, prevHref, nextHref, perPage } = pagination;
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-muted/25 px-3 py-3 shadow-xs md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:gap-y-2",
        hoverBordersOnly ? "border-transparent hover:border-border" : "border-border",
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
          <div
            className={cn(
              "inline-flex rounded-md border bg-background/80 p-0.5 transition-colors",
              hoverBordersOnly ? "border-transparent hover:border-border" : "border-border",
            )}
          >
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
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted transition-colors",
                hoverBordersOnly ? "border-transparent hover:border-border" : "border-border",
              )}
            >
              Précédent
            </Link>
          ) : (
            <span
              className={cn(
                "inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground",
                hoverBordersOnly ? "border-transparent" : "border-border/50",
              )}
            >
              Précédent
            </span>
          )}
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
            Page {safePage} / {totalPages}
          </span>
          {nextHref ? (
            <Link
              href={nextHref}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted transition-colors",
                hoverBordersOnly ? "border-transparent hover:border-border" : "border-border",
              )}
            >
              Suivant
            </Link>
          ) : (
            <span
              className={cn(
                "inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground",
                hoverBordersOnly ? "border-transparent" : "border-border/50",
              )}
            >
              Suivant
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
