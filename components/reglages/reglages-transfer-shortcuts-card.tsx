"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TransferShortcutsDialog } from "@/components/reglages/transfer-shortcuts-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ReglagesTransferShortcutsCardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("raccourcis") === "1") {
      setDialogOpen(true);
      router.replace("/reglages", { scroll: false });
    }
  }, [router, searchParams]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Raccourcis de transfert</CardTitle>
          <CardDescription>
            Destinations en un clic depuis la boîte de réception (menu sur chaque message). L’historique
            des envois reste consultable dans l’onglet Historique.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          Gérer les raccourcis
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <TransferShortcutsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onShortcutsChanged={() => router.refresh()}
        />
      </CardContent>
    </Card>
  );
}

export function ReglagesTransferShortcutsCard() {
  return (
    <Suspense fallback={null}>
      <ReglagesTransferShortcutsCardInner />
    </Suspense>
  );
}
