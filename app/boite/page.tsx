import { redirect } from "next/navigation";
import { BoiteComposeFab } from "@/components/boite/boite-compose-fab";
import { BoiteGmailSync } from "@/components/boite/boite-gmail-sync";
import { BoiteInboxFilter } from "@/components/boite/boite-inbox-filter";
import { BoiteMessagesList } from "@/components/boite/boite-messages-list";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ListPageToolbar } from "@/components/layout/list-page-toolbar";
import { getSessionUser } from "@/lib/auth";
import {
  BOITE_INBOX_PER_PAGE_OPTIONS,
  boiteInboxListHref,
  countBoiteMessages,
  loadBoiteMessages,
  parseBoiteInboxListQuery,
  type BoiteInboxPerPage,
} from "@/lib/boite/boite-messages";
import { CloudMailboxProvider } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type BoitePageProps = {
  searchParams?: Promise<{ page?: string; perPage?: string; unread?: string }>;
};

export default async function BoitePage({ searchParams }: BoitePageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const sp = (await searchParams) ?? {};
  const { page: rawPage, perPage, unreadOnly } = parseBoiteInboxListQuery(sp);
  const inboxExtras = { unreadOnly };

  const [total, transferShortcuts, mailbox, googleOAuth, outlookOAuth] =
    await Promise.all([
      countBoiteMessages(inboxExtras),
      prisma.transferShortcut.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, emails: true },
      }),
      prisma.appMailboxSettings.findUnique({
        where: { id: 1 },
        select: { activeProvider: true },
      }),
      prisma.googleOAuthSettings.findUnique({
        where: { id: 1 },
        select: {
          gmailPollIntervalSeconds: true,
          gmailSyncUnreadOnly: true,
          refreshToken: true,
        },
      }),
      prisma.outlookOAuthSettings.findUnique({
        where: { id: 1 },
        select: {
          outlookPollIntervalSeconds: true,
          outlookSyncUnreadOnly: true,
          refreshToken: true,
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * perPage;

  const messages = await loadBoiteMessages({
    skip,
    take: perPage,
    extras: inboxExtras,
  });

  const activeCloudProvider =
    mailbox?.activeProvider ?? CloudMailboxProvider.NONE;

  const pollIntervalSeconds =
    activeCloudProvider === CloudMailboxProvider.GOOGLE
      ? (googleOAuth?.gmailPollIntervalSeconds ?? 0)
      : activeCloudProvider === CloudMailboxProvider.OUTLOOK
        ? (outlookOAuth?.outlookPollIntervalSeconds ?? 0)
        : 0;

  const syncUnreadOnly =
    activeCloudProvider === CloudMailboxProvider.GOOGLE
      ? googleOAuth?.gmailSyncUnreadOnly !== false
      : activeCloudProvider === CloudMailboxProvider.OUTLOOK
        ? outlookOAuth?.outlookSyncUnreadOnly !== false
        : true;

  const cloudConnected =
    activeCloudProvider === CloudMailboxProvider.GOOGLE
      ? Boolean(googleOAuth?.refreshToken?.trim())
      : activeCloudProvider === CloudMailboxProvider.OUTLOOK
        ? Boolean(outlookOAuth?.refreshToken?.trim())
        : false;

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const rangeLabel =
    total === 0
      ? unreadOnly
        ? "Aucun message non lu."
        : "Aucun message sur cette page."
      : `${from}–${to} sur ${total} message${total > 1 ? "s" : ""}${
          unreadOnly ? " (non lus)" : ""
        }`;

  const prevHref =
    page > 1
      ? boiteInboxListHref({ page: page - 1, perPage, unreadOnly })
      : null;
  const nextHref =
    page < totalPages
      ? boiteInboxListHref({ page: page + 1, perPage, unreadOnly })
      : null;

  const hrefForPerPage = (n: number) =>
    boiteInboxListHref({
      page: 1,
      perPage: n as BoiteInboxPerPage,
      unreadOnly,
    });

  return (
    <DashboardShell
      currentTab="boite"
      title="Boite de reception"
      userEmail={user.email}
      isAdmin={user.isAdmin}
      headerToolbar={
        <div data-tutorial-target="tutoriel-boite-toolbar">
          <ListPageToolbar
            rangeLabel={rangeLabel}
            filterSlot={<BoiteInboxFilter unreadOnly={unreadOnly} perPage={perPage} />}
            pagination={{
              page,
              totalPages,
              prevHref,
              nextHref,
              perPage: {
                value: perPage,
                options: BOITE_INBOX_PER_PAGE_OPTIONS,
                hrefForPerPage,
              },
            }}
            paginationAriaLabel="Pagination de la boîte de réception"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Messages enregistres (passerelle SMTP et/ou import Gmail ou Outlook), du plus recent au
          plus ancien. Les messages déjà traités (transfert, règle, archivage) sont archivés : voir
          l&apos;onglet <strong>Traité</strong>. Survoler
          l&apos;heure d&apos;un message importé depuis le cloud affiche l&apos;identifiant côté API
          (Google ou Microsoft).
        </p>

        <div data-tutorial-target="tutoriel-boite-sync">
          <BoiteGmailSync
            key={`${activeCloudProvider}-${cloudConnected ? "on" : "off"}`}
            pollIntervalSeconds={pollIntervalSeconds}
            cloudConnected={cloudConnected}
            syncUnreadOnly={syncUnreadOnly}
            activeCloudProvider={activeCloudProvider}
          />
        </div>

        <div data-tutorial-target="tutoriel-boite-liste">
          <BoiteMessagesList
            messages={messages}
            emptyTitle="Aucun message"
            emptyDescription="Des qu&apos;un mail arrive sur une adresse d&apos;entree (passerelle SMTP + regles), il apparaitra ici."
            listAriaLabel="Messages recus"
            showTransferAction
            transferShortcuts={transferShortcuts}
            showArchiveAction
          />
        </div>

        <BoiteComposeFab />
      </div>
    </DashboardShell>
  );
}
