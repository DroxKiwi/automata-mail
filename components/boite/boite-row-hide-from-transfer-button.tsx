"use client";

import { ListX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BoiteRowHideFromTransferButtonProps = {
  messageId: number;
};

export function BoiteRowHideFromTransferButton({
  messageId,
}: BoiteRowHideFromTransferButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function hideFromList() {
    setPending(true);
    try {
      const res = await fetch(`/api/inbound/messages/${messageId}/transfer-list`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenFromTransferList: true }),
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
          aria-label="Retirer de la liste des messages traités"
          onClick={() => void hideFromList()}
        >
          <ListX className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Retirer de la liste Traité</TooltipContent>
    </Tooltip>
  );
}
