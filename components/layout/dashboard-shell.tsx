import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import packageJson from "../../package.json";
import { OllamaBuddy } from "@/components/assistant/ollama-buddy";
import { LogoutButton } from "@/components/layout/logout-button";
import { TutorialStartButton } from "@/components/tutorial";

type DashboardTab =
  | "automate"
  | "boite"
  | "documentation"
  | "filtres"
  | "historique"
  | "reglages"
  | "transfere"
  | "utilisateurs";

type DashboardShellProps = {
  /** Onglet latéral actif ; omis sur l’accueil pour n’en surligner aucun. */
  currentTab?: DashboardTab;
  title: string;
  userEmail: string;
  /** Affiche l’onglet de gestion des comptes (réservé aux administrateurs). */
  isAdmin?: boolean;
  /** Si false, le contenu n’est pas enveloppé dans la carte (ex. lecteur message). */
  contentFrame?: boolean;
  /** Actions à droite du titre (ex. bouton secondaire). */
  titleActions?: ReactNode;
  /**
   * Bandeau sous le titre (filtres, pagination, etc.) — pleine largeur sous la ligne titre.
   */
  headerToolbar?: ReactNode;
  children: ReactNode;
};

function tabClass(isActive: boolean): string {
  if (isActive) {
    return "bg-primary text-primary-foreground";
  }

  return "text-muted-foreground hover:bg-muted hover:text-foreground";
}

export function DashboardShell({
  currentTab,
  title,
  userEmail,
  isAdmin = false,
  contentFrame = true,
  titleActions,
  headerToolbar,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-24 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-2 py-4 md:w-80 md:px-5">
        <div className="mb-5 flex flex-col gap-1.5">
          <div className="flex justify-center md:justify-start">
            <Link
              href="/"
              className="inline-block max-w-full rounded-sm outline-none ring-sidebar-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              <Image
                src="/logo3_big.png"
                alt="Exparta Automata Mail"
                width={1000}
                height={350}
                className="h-10 w-auto object-contain object-center md:h-14 md:object-left"
                priority
                sizes="(max-width: 767px) 128px, 360px"
              />
            </Link>
          </div>
          <p className="text-center text-xs font-bold leading-tight text-sidebar-foreground md:text-left md:text-sm">
            Automata Mail
          </p>
          <p
            className="text-center text-[10px] font-medium tabular-nums text-muted-foreground md:text-left md:text-xs"
            title={`Version ${packageJson.version}`}
          >
            version {packageJson.version}
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          <Link
            href="/boite"
            data-tutorial-target="boite"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "boite"
            )}`}
          >
            <span className="md:hidden">Boite</span>
            <span className="hidden md:inline">Boite de reception</span>
          </Link>
          <Link
            href="/transfere"
            data-tutorial-target="transfere"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "transfere"
            )}`}
          >
            <span className="md:hidden">Trait.</span>
            <span className="hidden md:inline">Traité</span>
          </Link>
          <Link
            href="/historique"
            data-tutorial-target="historique"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "historique"
            )}`}
          >
            Historique
          </Link>
          <Link
            href="/filtres"
            data-tutorial-target="filtres"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "filtres"
            )}`}
          >
            Filtres
          </Link>
          <Link
            href="/automate"
            data-tutorial-target="automate"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "automate"
            )}`}
          >
            <span className="md:hidden">Auto.</span>
            <span className="hidden md:inline">Automate</span>
          </Link>
          <Link
            href="/documentation"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "documentation"
            )}`}
          >
            <span className="md:hidden">Doc.</span>
            <span className="hidden md:inline">Documentation</span>
          </Link>
          <Link
            href="/reglages"
            data-tutorial-target="reglages"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "reglages"
            )}`}
          >
            Reglages
          </Link>
          {isAdmin ? (
            <Link
              href="/utilisateurs"
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
                currentTab === "utilisateurs"
              )}`}
            >
              <span className="md:hidden">Util.</span>
              <span className="hidden md:inline">Utilisateurs</span>
            </Link>
          ) : null}
        </nav>

        <div className="mt-auto flex w-full min-w-0 flex-col gap-3 border-t border-sidebar-border pt-4">
          <TutorialStartButton />
          <div className="rounded-lg border border-sidebar-border bg-card p-3">
            <p className="text-sm font-semibold">Mon profil</p>
            <p className="mt-1 break-all text-xs text-muted-foreground" title={userEmail}>
              {userEmail}
            </p>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-24 md:pl-80">
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="line-clamp-2 min-w-0 flex-1 text-balance" title={title}>
                {title}
              </h1>
              {titleActions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{titleActions}</div>
              ) : null}
            </div>
            {headerToolbar ? <div className="min-w-0">{headerToolbar}</div> : null}
          </div>
          {contentFrame ? (
            <section className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs md:p-6">
              {children}
            </section>
          ) : (
            children
          )}
        </main>

        <footer className="border-t border-border bg-secondary px-4 py-3 text-center text-sm text-secondary-foreground">
          Exparta Automata Mail — routage et règles de messagerie professionnelle
        </footer>
      </div>

      <OllamaBuddy />
    </div>
  );
}
