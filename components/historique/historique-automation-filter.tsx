"use client";

import Link from "next/link";
import type { MailHistoryListCategory } from "@/lib/historique/mail-history-presenter";
import { historiqueListHref, type HistoriquePerPage } from "@/lib/historique/historique-list-query";
import { cn } from "@/lib/utils";

export type HistoriqueAutomationTabItem = { id: number; name: string };

type HistoriqueAutomationFilterProps = {
  automations: HistoriqueAutomationTabItem[];
  currentAutomationId: number | null;
  perPage: HistoriquePerPage;
  category: MailHistoryListCategory;
};

export function HistoriqueAutomationFilter({
  automations,
  currentAutomationId,
  perPage,
  category,
}: HistoriqueAutomationFilterProps) {
  if (automations.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2 md:border-t-0 md:pt-0"
      role="group"
      aria-label="Filtrer par automatisation"
    >
      <span className="w-full text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:w-auto md:pe-1">
        Automatisations
      </span>
      <Link
        href={historiqueListHref({ page: 1, perPage, category })}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm",
          currentAutomationId == null
            ? "border-primary bg-primary/15 text-foreground"
            : "border-transparent bg-background/60 text-muted-foreground hover:border-border hover:text-foreground",
        )}
      >
        Toutes
      </Link>
      {automations.map((a) => {
        const active = currentAutomationId === a.id;
        return (
          <Link
            key={a.id}
            title={a.name}
            href={historiqueListHref({
              page: 1,
              perPage,
              category,
              automation: a.id,
            })}
            className={cn(
              "max-w-[10rem] truncate rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:max-w-[14rem] sm:text-sm",
              active
                ? "border-primary bg-primary/15 text-foreground"
                : "border-transparent bg-background/60 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {a.name}
          </Link>
        );
      })}
    </div>
  );
}
