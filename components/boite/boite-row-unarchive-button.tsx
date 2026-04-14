"use client";

import { ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BoiteRowUnarchiveButtonProps = {
  messageId: number;
};

export function BoiteRowUnarchiveButton({ messageId }: BoiteRowUnarchiveButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function unarchive() {
    setPending(true);
    try {
      const res = await fetch(`/api/inbound/messages/${messageId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={pending}
          aria-label="Désarchiver"
          onClick={() => void unarchive()}
        >
          <ArchiveRestore className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Désarchiver</TooltipContent>
    </Tooltip>
  );
}
