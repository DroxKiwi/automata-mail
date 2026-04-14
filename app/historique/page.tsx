import Link from "next/link";
import { redirect } from "next/navigation";
import { HistoriqueAutomationFilter } from "@/components/historique/historique-automation-filter";
import { HistoriqueCategoryFilter } from "@/components/historique/historique-category-filter";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ListPageToolbar } from "@/components/layout/list-page-toolbar";
import { getSessionUser } from "@/lib/auth";
import {
  historiqueListHref,
  HISTORIQUE_PER_PAGE_OPTIONS,
  parseHistoriqueListQuery,
  type HistoriquePerPage,
} from "@/lib/historique/historique-list-query";
import {
  mailHistoryPrismaWhere,
  presentMailFlowEvents,
  type MailHistoryCategory,
} from "@/lib/historique/mail-history-presenter";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

function categoryBadge(category: MailHistoryCategory) {
  const styles: Record<MailHistoryCategory, string> = {
    reception:
      "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30",
    transfert:
      "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
    traitement:
      "bg-teal-500/15 text-teal-900 dark:text-teal-100 border-teal-500/30",
    synchro:
      "bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/30",
    redaction:
      "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30",
    alerte:
      "bg-orange-500/15 text-orange-900 dark:text-orange-100 border-orange-500/30",
    erreur:
      "bg-destructive/15 text-destructive border-destructive/30",
  };

  const labels: Record<MailHistoryCategory, string> = {
    reception: "Réception",
    transfert: "Transfert / envoi",
    traitement: "Traitement",
    synchro: "Synchro boîte",
    redaction: "Rédaction",
    alerte: "Alerte",
    erreur: "Erreur",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
        styles[category],
      )}
    >
      {labels[category]}
    </span>
  );
}

function formatDetailJson(detail: unknown): string | null {
  if (detail === null || detail === undefined) {
    return null;
  }
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

type HistoriquePageProps = {
  searchParams?: Promise<{
    page?: string;
    perPage?: string;
    category?: string;
    automation?: string;
  }>;
};

export default async function HistoriquePage({ searchParams }: HistoriquePageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const sp = (await searchParams) ?? {};
  const { page: rawPage, perPage, category, automationId } =
    parseHistoriqueListQuery(sp);

  const where = { ...mailHistoryPrismaWhere(category, automationId), userId: user.id };

  const [automationTabs, total] = await Promise.all([
    prisma.automation.findMany({
      where: { userId: user.id, enabled: true },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.mailFlowEvent.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * perPage;

  const events = await prisma.mailFlowEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: perPage,
  });

  const rows = presentMailFlowEvents(events);

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const rangeLabel =
    total === 0
      ? "Aucun événement pour ces critères."
      : `${from}–${to} sur ${total} événement${total > 1 ? "s" : ""}`;

  const prevHref =
    page > 1
      ? historiqueListHref({
          page: page - 1,
          perPage,
          category,
          automation: automationId ?? undefined,
        })
      : null;
  const nextHref =
    page < totalPages
      ? historiqueListHref({
          page: page + 1,
          perPage,
          category,
          automation: automationId ?? undefined,
        })
      : null;

  const hrefForPerPage = (n: number) =>
    historiqueListHref({
      page: 1,
      perPage: n as HistoriquePerPage,
      category,
      automation: automationId ?? undefined,
    });

  return (
    <DashboardShell
      currentTab="historique"
      title="Historique"
      userEmail={user.email}
      isAdmin={user.isAdmin}
      headerToolbar={
        <div data-tutorial-target="tutoriel-historique-toolbar">
          <ListPageToolbar
            rangeLabel={rangeLabel}
            filterSlot={
              <div className="flex w-full flex-col gap-2">
                <HistoriqueCategoryFilter
                  current={category}
                  perPage={perPage}
                  automationId={automationId}
                />
                <HistoriqueAutomationFilter
                  automations={automationTabs}
                  currentAutomationId={automationId}
                  perPage={perPage}
                  category={category}
                />
              </div>
            }
            pagination={{
              page,
              totalPages,
              prevHref,
              nextHref,
              perPage: {
                value: perPage,
                options: HISTORIQUE_PER_PAGE_OPTIONS,
                hrefForPerPage,
              },
            }}
            paginationAriaLabel="Pagination de l’historique"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-2" data-tutorial-target="tutoriel-historique-intro">
          <p className="text-sm text-muted-foreground">
            Journal des actions : réception, enregistrement en boîte, transferts et traitements par
            règles ou raccourcis, archivages, envois depuis la rédaction, synchro Gmail/Outlook. Filtre
            par type ou par automatisation active ; la pagination conserve le filtre choisi.
          </p>
        </div>

        <div data-tutorial-target="tutoriel-historique-liste">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun événement pour le moment. Lorsqu&apos;un message arrive sur la passerelle ou qu&apos;une
            action est effectuée depuis la boîte, elle apparaîtra ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => {
              const detailStr = formatDetailJson(row.detail);
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
                      {categoryBadge(row.category)}
                      <time
                        dateTime={row.at.toISOString()}
                        className="text-xs tabular-nums text-muted-foreground sm:max-w-[9rem]"
                      >
                        {row.at.toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </time>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h2 className="text-sm font-semibold leading-snug text-foreground">
                          {row.title}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          · {row.actorLabel}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {row.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                        <span className="font-mono" title={row.correlationId}>
                          Trace :{" "}
                          {row.correlationId.length > 20
                            ? `${row.correlationId.slice(0, 12)}…`
                            : row.correlationId}
                        </span>
                        {row.inboundMessageId ? (
                          <Link
                            href={`/boite/${row.inboundMessageId}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            Ouvrir le message #{row.inboundMessageId}
                          </Link>
                        ) : null}
                      </div>
                      {detailStr ? (
                        <details className="pt-2">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            Détails techniques
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                            {detailStr}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>
    </DashboardShell>
  );
}
