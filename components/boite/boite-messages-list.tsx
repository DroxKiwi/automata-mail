"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoiteMessageRow } from "@/components/boite/boite-message-row";
import type { TransferShortcutItem } from "@/components/reglages/transfer-shortcuts-dialog";
import type { BoiteListMessage } from "@/lib/boite/boite-messages";

type BoiteMessagesListProps = {
  messages: BoiteListMessage[];
  emptyTitle: string;
  emptyDescription: string;
  listAriaLabel: string;
  /** Icône archiver + infobulle (boîte de réception). */
  showArchiveAction?: boolean;
  /** Icône désarchiver + infobulle (liste Traité). */
  showUnarchiveAction?: boolean;
  /** Menu transférer + raccourcis (boîte de réception). */
  showTransferAction?: boolean;
  /** Bouton retirer de l’onglet Traité (colonne de droite). */
  showHideFromTransferListAction?: boolean;
  transferShortcuts?: TransferShortcutItem[];
  hoverBordersOnly?: boolean;
};

export function BoiteMessagesList({
  messages,
  emptyTitle,
  emptyDescription,
  listAriaLabel,
  showArchiveAction = false,
  showUnarchiveAction = false,
  showTransferAction = false,
  showHideFromTransferListAction = false,
  transferShortcuts = [],
  hoverBordersOnly = true,
}: BoiteMessagesListProps) {
  if (messages.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">{emptyTitle}</CardTitle>
          <CardDescription>{emptyDescription}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <ul
        className={`overflow-hidden rounded-lg border text-sm transition-colors ${
          hoverBordersOnly ? "border-transparent hover:border-border" : "border-border"
        }`}
        aria-label={listAriaLabel}
      >
        {messages.map((m) => (
          <BoiteMessageRow
            key={m.id}
            m={m}
            hoverBordersOnly={hoverBordersOnly}
            showArchiveAction={showArchiveAction}
            showUnarchiveAction={showUnarchiveAction}
            showTransferAction={showTransferAction}
            showHideFromTransferListAction={showHideFromTransferListAction}
            transferShortcuts={transferShortcuts}
          />
        ))}
      </ul>
    </TooltipProvider>
  );
}
