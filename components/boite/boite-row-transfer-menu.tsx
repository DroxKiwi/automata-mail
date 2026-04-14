"use client";

import { Forward } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TransferShortcutItem } from "@/components/reglages/transfer-shortcuts-dialog";

type BoiteRowTransferMenuProps = {
  messageId: number;
  shortcuts: TransferShortcutItem[];
};

function shortcutMenuLabel(emails: string[]): string {
  if (emails.length === 0) {
    return "—";
  }
  if (emails.length === 1) {
    return emails[0] ?? "";
  }
  const first = emails[0] ?? "";
  return `${first} (+${emails.length - 1})`;
}

export function BoiteRowTransferMenu({ messageId, shortcuts }: BoiteRowTransferMenuProps) {
  const router = useRouter();
  const [pendingShortcutId, setPendingShortcutId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  async function forwardWithShortcut(shortcutId: number) {
    setPendingShortcutId(shortcutId);
    try {
      const res = await fetch(`/api/inbound/messages/${messageId}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcutId }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (res.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      const msg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "Transfert impossible.";
      window.alert(msg);
    } finally {
      setPendingShortcutId(null);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              disabled={pendingShortcutId !== null}
              aria-label="Transférer"
              aria-haspopup="menu"
            >
              <Forward className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Transférer</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {shortcuts.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            Aucun raccourci — ajoutez-en dans Réglages
          </DropdownMenuItem>
        ) : (
          shortcuts.map((s) => {
            const label =
              pendingShortcutId === s.id ? "Envoi…" : shortcutMenuLabel(s.emails);

            if (s.emails.length <= 1) {
              return (
                <DropdownMenuItem
                  key={s.id}
                  disabled={pendingShortcutId !== null}
                  onSelect={(e) => {
                    e.preventDefault();
                    void forwardWithShortcut(s.id);
                  }}
                >
                  {label}
                </DropdownMenuItem>
              );
            }

            return (
              <Tooltip key={s.id} delayDuration={350}>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    disabled={pendingShortcutId !== null}
                    aria-label={`Transférer vers ${s.emails.join(", ")}`}
                    onSelect={(e) => {
                      e.preventDefault();
                      void forwardWithShortcut(s.id);
                    }}
                  >
                    {label}
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  align="center"
                  sideOffset={10}
                  className="z-[200] max-w-[min(22rem,calc(100vw-2rem))] px-3 py-2 text-left font-normal"
                >
                  <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Destinataires
                  </p>
                  <ul className="space-y-1 text-sm leading-snug text-popover-foreground">
                    {s.emails.map((email) => (
                      <li key={email} className="break-all">
                        {email}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reglages?raccourcis=1">Gérer les raccourcis</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
