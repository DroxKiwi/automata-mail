import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentationMarkdown } from "@/components/docs/documentation-markdown";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionUser } from "@/lib/auth";

const OFFICIAL_REPO_URL =
  "https://github.com/DroxKiwi/test-system-redirect-mail-exparta" as const;

export default async function DocumentationPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  let markdown = "";
  try {
    markdown = await readFile(path.join(process.cwd(), "README.md"), "utf8");
  } catch {
    markdown =
      "# Documentation indisponible\n\nLe fichier `README.md` à la racine du projet est introuvable.";
  }

  return (
    <DashboardShell
      currentTab="documentation"
      title="Documentation"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="mb-6 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground md:px-5 md:py-4">
        <p className="text-muted-foreground">
          Le dépôt officiel du projet (code source, suivi des versions et fichiers de configuration
          partagés) est hébergé sur GitHub à l’adresse suivante :
        </p>
        <p className="mt-2">
          <Link
            href={OFFICIAL_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex break-all font-medium text-primary underline-offset-4 hover:underline"
          >
            {OFFICIAL_REPO_URL}
          </Link>
        </p>
      </div>
      <DocumentationMarkdown markdown={markdown} />
    </DashboardShell>
  );
}
