import { ArrowLeft, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BoiteMarkReadOnOpen } from "@/components/boite/boite-mark-read-on-open";
import { MailHtmlPreview } from "@/components/mail/mail-html-preview";
import { MessageArchiveActions } from "@/components/boite/message-archive-actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth";
import {
  formatRcpt,
  headersEntries,
  senderLabel,
} from "@/lib/mail/mail-display";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type BoiteMessageDetail = {
  id: number;
  archived: boolean;
  correlationId: string | null;
  gmailMessageId: string | null;
  outlookMessageId: string | null;
  readAt: Date | null;
  mailFrom: string;
  rcptTo: Prisma.JsonValue;
  subject: string | null;
  headers: Prisma.JsonValue;
  messageIdHeader: string | null;
  textBody: string | null;
  htmlBody: string | null;
  rawMime: string;
  receivedAt: Date;
  inboundAddress: { localPart: string; domain: string };
  attachments: Array<{
    id: number;
    filename: string | null;
    contentType: string | null;
    sizeBytes: number;
  }>;
};

export default async function BoiteMessagePage(props: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id: idParam } = await props.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const [messageRaw, googleSettings, outlookSettings] = await Promise.all([
    prisma.inboundMessage.findFirst({
      where: {
        id,
        userId: user.id,
        inboundAddress: { isActive: true },
      },
      include: {
        inboundAddress: true,
        attachments: { orderBy: { id: "asc" } },
      } as unknown as Prisma.InboundMessageInclude,
    }),
    prisma.googleOAuthSettings.findUnique({
      where: { userId: user.id },
      select: { gmailMarkReadOnOpen: true },
    }),
    prisma.outlookOAuthSettings.findUnique({
      where: { userId: user.id },
      select: { outlookMarkReadOnOpen: true },
    }),
  ]);

  const message = messageRaw as unknown as BoiteMessageDetail | null;

  if (!message) {
    notFound();
  }

  const addr = `${message.inboundAddress.localPart}@${message.inboundAddress.domain}`;
  const rcpt = formatRcpt(message.rcptTo);
  const destinataire = rcpt && rcpt !== addr ? `${addr} · ${rcpt}` : addr;
  const subject = message.subject?.trim() || null;
  const title = subject ?? "Message";
  const headerRows = headersEntries(message.headers);

  const gmailId = message.gmailMessageId?.trim() ?? "";
  const outlookId = message.outlookMessageId?.trim() ?? "";
  const markReadOnOpenEnabled =
    (gmailId.length > 0 && googleSettings?.gmailMarkReadOnOpen === true) ||
    (outlookId.length > 0 && outlookSettings?.outlookMarkReadOnOpen === true);
  const cloudProviderMessageId =
    gmailId.length > 0 ? gmailId : outlookId.length > 0 ? outlookId : null;

  const backHref = message.archived ? "/transfere" : "/boite";
  const backLabel = message.archived
    ? "Retour à Traité"
    : "Retour à la boîte de réception";

  return (
    <DashboardShell
      currentTab={message.archived ? "transfere" : "boite"}
      title={title}
      userEmail={user.email}
      isAdmin={user.isAdmin}
      contentFrame={false}
    >
      <div className="w-full min-w-0 space-y-6">
        <BoiteMarkReadOnOpen
          messageId={message.id}
          cloudProviderMessageId={cloudProviderMessageId}
          alreadyRead={message.readAt != null}
          enabled={markReadOnOpenEnabled}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            {backLabel}
          </Link>
          <MessageArchiveActions
            messageId={message.id}
            archived={message.archived}
          />
        </div>

        <article className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <header className="space-y-1 border-b border-border bg-muted/25 px-5 py-5 md:px-6">
            <h2 className="text-lg font-semibold leading-snug md:text-xl">
              {subject ?? (
                <span className="text-muted-foreground">(Sans objet)</span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              Reçu le{" "}
              {message.receivedAt.toLocaleString("fr-FR", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          </header>

          <div className="grid gap-4 px-5 py-5 md:grid-cols-[8rem_1fr] md:gap-x-6 md:px-6 md:py-6">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:pt-0.5">
              Expéditeur
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{senderLabel(message.mailFrom)}</p>
              <p className="break-all text-muted-foreground">{message.mailFrom}</p>
            </div>

            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:pt-0.5">
              Destinataire
            </div>
            <div className="min-w-0 break-all text-sm text-muted-foreground">
              {destinataire}
            </div>

            {message.messageIdHeader ? (
              <>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:pt-0.5">
                  Message-ID
                </div>
                <div className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                  {message.messageIdHeader}
                </div>
              </>
            ) : null}

            {message.correlationId ? (
              <>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:pt-0.5">
                  Trace
                </div>
                <div className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                  {message.correlationId}
                </div>
              </>
            ) : null}
          </div>

          {message.attachments.length > 0 ? (
            <>
              <Separator />
              <div className="px-5 py-4 md:px-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                  Pièces jointes
                </h3>
                <ul className="space-y-2 text-sm">
                  {message.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border/80 bg-muted/20 px-3 py-2"
                    >
                      <span className="font-medium">
                        {a.filename ?? "Sans nom"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.contentType ?? "type inconnu"} ·{" "}
                        {formatFileSize(a.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          <Separator />

          <div className="space-y-6 px-5 py-6 md:px-6">
            {message.textBody?.trim() ? (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Texte brut
                </h3>
                <div className="rounded-lg border border-border/80 bg-muted/15 p-4">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                    {message.textBody.trim()}
                  </pre>
                </div>
              </section>
            ) : null}

            {message.htmlBody?.trim() ? (
              <section>
                <MailHtmlPreview html={message.htmlBody} />
              </section>
            ) : null}

            {!message.textBody?.trim() && !message.htmlBody?.trim() ? (
              <p className="text-sm text-muted-foreground">
                Aucun corps texte ou HTML extrait pour ce message (voir en-têtes ou
                source brute si besoin).
              </p>
            ) : null}

            {headerRows.length > 0 ? (
              <details className="rounded-lg border border-border/80 bg-muted/10">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                  En-têtes complets ({headerRows.length})
                </summary>
                <div className="max-h-64 overflow-auto border-t border-border/80 px-4 py-3">
                  <dl className="space-y-2 font-mono text-xs">
                    {headerRows.map(({ key, value }) => (
                      <div key={key} className="grid gap-1 sm:grid-cols-[minmax(0,12rem)_1fr]">
                        <dt className="shrink-0 text-muted-foreground">{key}</dt>
                        <dd className="min-w-0 break-all text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
            ) : null}

            <details className="rounded-lg border border-dashed border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
                Source MIME brute
              </summary>
              <pre className="max-h-80 overflow-auto border-t border-border p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {message.rawMime}
              </pre>
            </details>
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
