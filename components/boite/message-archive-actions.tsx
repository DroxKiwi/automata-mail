"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";

type MessageArchiveActionsProps = {
  messageId: number;
  archived: boolean;
};

export function MessageArchiveActions({
  messageId,
  archived,
}: MessageArchiveActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setArchived(next: boolean) {
    setPending(true);
    try {
      const res = await fetch(`/api/inbound/messages/${messageId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: next }),
      });
      if (!res.ok) {
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (archived) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={pending}
        onClick={() => void setArchived(false)}
      >
        <ArchiveRestore className="size-4" aria-hidden />
        Desarchiver
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={() => void setArchived(true)}
    >
      <Archive className="size-4" aria-hidden />
      Archiver
    </Button>
  );
}
