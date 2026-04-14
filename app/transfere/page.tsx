import { redirect } from "next/navigation";
import { BoiteMessagesList } from "@/components/boite/boite-messages-list";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { loadTraiteMessages } from "@/lib/boite/boite-messages";

export const dynamic = "force-dynamic";

export default async function TransferePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const messages = await loadTraiteMessages(user.id);

  return (
    <DashboardShell
      currentTab="transfere"
      title="Traité"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="flex flex-col gap-4">
        <p
          className="text-sm text-muted-foreground"
          data-tutorial-target="tutoriel-transfere-intro"
        >
          Messages <strong>traités</strong> (archivés, transférés, action de règle, etc.). La boîte de
          réception ne liste que les courriers non traités. Raccourcis de transfert :{" "}
          <a href="/reglages" className="text-primary underline-offset-2 hover:underline">
            Réglages
          </a>
          . Détail des événements : <strong>Historique</strong>. Le bouton à droite masque la ligne
          sans supprimer le message ; <strong>Désarchiver</strong> renvoie un message vers la boîte
          s’il n’a pas d’autre trace de traitement.
        </p>

        <div data-tutorial-target="tutoriel-transfere-liste">
          <BoiteMessagesList
            messages={messages}
            emptyTitle="Aucun message traité pour l’instant"
            emptyDescription="Les messages sortent de la boîte dès qu’ils sont traités (manuellement ou par une règle)."
            listAriaLabel="Messages traités"
            showHideFromTransferListAction
            showUnarchiveAction
          />
        </div>
      </div>
    </DashboardShell>
  );
}
