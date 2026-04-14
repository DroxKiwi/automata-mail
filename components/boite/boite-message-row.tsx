"use client";

import { Paperclip } from "lucide-react";
import Link from "next/link";
import { BoiteRowArchiveButton } from "@/components/boite/boite-row-archive-button";
import { BoiteRowHideFromTransferButton } from "@/components/boite/boite-row-hide-from-transfer-button";
import { BoiteRowTransferMenu } from "@/components/boite/boite-row-transfer-menu";
import { BoiteRowUnarchiveButton } from "@/components/boite/boite-row-unarchive-button";
import type { TransferShortcutItem } from "@/components/reglages/transfer-shortcuts-dialog";
import {
  formatRcpt,
  formatReceivedShort,
  previewText,
  senderLabel,
} from "@/lib/mail/mail-display";
import type { BoiteListMessage } from "@/lib/boite/boite-messages";
import { cn } from "@/lib/utils";

type BoiteMessageRowProps = {
  m: BoiteListMessage;
  hoverBordersOnly?: boolean;
  /** Bouton archiver (boîte de réception). */
  showArchiveAction?: boolean;
  /** Bouton désarchiver (liste Traité). */
  showUnarchiveAction?: boolean;
  showTransferAction?: boolean;
  /** Retirer de la liste Traité (colonne de droite). */
  showHideFromTransferListAction?: boolean;
  transferShortcuts?: TransferShortcutItem[];
};

export function BoiteMessageRow({
  m,
  hoverBordersOnly = true,
  showArchiveAction = false,
  showUnarchiveAction = false,
  showTransferAction = false,
  showHideFromTransferListAction = false,
  transferShortcuts = [],
}: BoiteMessageRowProps) {
  const addr = `${m.inboundAddress.localPart}@${m.inboundAddress.domain}`;
  const rcpt = formatRcpt(m.rcptTo);
  const destinataire = rcpt && rcpt !== addr ? `${addr} (${rcpt})` : addr;
  const preview = previewText(m.textBody);
  const subject = m.subject?.trim();
  const hasAttachments = m.attachments.length > 0;
  const isRead = m.readAt != null;

  const a11yLabel = [
    isRead ? "Lu." : "Non lu.",
    `Reçu ${m.receivedAt.toLocaleString("fr-FR")}`,
    `expéditeur ${m.mailFrom}`,
    `destinataire ${destinataire}`,
    subject ? `sujet ${subject}` : "sans sujet",
    preview ? `aperçu ${preview}` : null,
    hasAttachments ? "contient des pièces jointes" : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <li
      className={cn(
        "group flex min-h-[2.75rem] items-stretch border-b last:border-b-0 transition-colors",
        hoverBordersOnly ? "border-b-transparent hover:border-b-border" : "border-b-border/50",
        isRead
          ? "bg-muted/85 dark:bg-muted/70"
          : "bg-sky-50 dark:bg-sky-950/30"
      )}
    >
      <Link
        href={`/boite/${m.id}`}
        aria-label={a11yLabel}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-3",
          isRead
            ? "hover:bg-muted focus-visible:bg-muted dark:hover:bg-muted/90 dark:focus-visible:bg-muted/90"
            : "hover:bg-sky-100/90 focus-visible:bg-sky-100/90 dark:hover:bg-sky-950/45 dark:focus-visible:bg-sky-950/45"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-baseline sm:gap-4">
          <div className="w-[min(42%,11rem)] shrink-0 sm:w-44 md:w-52">
            <div className="truncate font-semibold text-foreground" title={m.mailFrom}>
              {senderLabel(m.mailFrom)}
            </div>
            <div
              className="truncate text-xs leading-snug text-muted-foreground"
              title={destinataire}
            >
              {destinataire}
            </div>
          </div>
          <div className="min-w-0 flex-1 truncate pt-0.5 sm:pt-0">
            {subject ? (
              <span className="font-semibold text-foreground">{subject}</span>
            ) : (
              <span className="font-semibold text-muted-foreground">(Sans objet)</span>
            )}
            {preview ? (
              <>
                <span className="font-normal text-muted-foreground"> - </span>
                <span className="font-normal text-muted-foreground">{preview}</span>
              </>
            ) : null}
          </div>
        </div>
      </Link>

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 border-l py-1 pr-2 pl-1 transition-colors sm:gap-1 sm:pr-3",
          hoverBordersOnly ? "border-l-transparent group-hover:border-l-border" : "border-l-border/60",
          isRead
            ? "bg-muted/80 dark:bg-muted/65"
            : "bg-sky-50/95 dark:bg-sky-950/35"
        )}
      >
        {hasAttachments ? (
          <span
            className="flex size-8 items-center justify-center text-muted-foreground"
            title="Pièces jointes"
          >
            <Paperclip className="size-4" aria-hidden />
            <span className="sr-only">Pièces jointes</span>
          </span>
        ) : (
          <span className="size-8 shrink-0 sm:size-8" aria-hidden />
        )}
        <time
          dateTime={m.receivedAt.toISOString()}
          className="flex w-[3.25rem] shrink-0 items-center justify-end text-right text-xs font-semibold tabular-nums text-foreground sm:w-14"
          title={[
            m.receivedAt.toLocaleString("fr-FR", {
              dateStyle: "full",
              timeStyle: "short",
            }),
            m.gmailMessageId
              ? `Import Gmail · id message ${m.gmailMessageId}`
              : m.outlookMessageId
                ? `Import Outlook · id message ${m.outlookMessageId}`
                : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {formatReceivedShort(m.receivedAt)}
        </time>
        {showTransferAction ? (
          <BoiteRowTransferMenu messageId={m.id} shortcuts={transferShortcuts} />
        ) : null}
        {showHideFromTransferListAction ? (
          <BoiteRowHideFromTransferButton messageId={m.id} />
        ) : null}
        {showArchiveAction ? <BoiteRowArchiveButton messageId={m.id} /> : null}
        {showUnarchiveAction ? <BoiteRowUnarchiveButton messageId={m.id} /> : null}
      </div>
    </li>
  );
}
