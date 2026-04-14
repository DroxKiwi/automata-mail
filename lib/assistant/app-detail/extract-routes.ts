import { readdir } from "node:fs/promises";
import path from "node:path";
import { TUTORIAL_STEPS } from "@/components/tutorial/tutorial-steps";
import { toAssistantPath } from "@/lib/assistant/app-detail/alias-map";
import type { AppAccessLevel, AppDetailNode } from "@/lib/assistant/app-detail/types";

const APP_ROOT_DIR = path.join(process.cwd(), "app");
const SIDEBAR_PATHS = ["/boite", "/transfere", "/historique", "/filtres", "/automate", "/documentation", "/reglages", "/utilisateurs"];

type RouteShape = {
  canonicalPath: string;
  source: Array<"app-routes" | "sidebar" | "tutorial">;
};

function toCanonicalPathFromFile(relativePath: string): string | null {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!normalized.endsWith("/page.tsx")) {
    return null;
  }
  const withoutSuffix = normalized.slice(0, -"/page.tsx".length);
  if (withoutSuffix === "") {
    return "/";
  }
  if (withoutSuffix.startsWith("api/")) {
    return null;
  }
  const segments = withoutSuffix.split("/").map((segment) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      return `:${segment.slice(1, -1)}`;
    }
    return segment;
  });
  return `/${segments.join("/")}`;
}

async function collectPageFiles(dir: string, base = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolute = path.join(dir, entry.name);
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await collectPageFiles(absolute, relative)));
      continue;
    }
    if (entry.isFile() && entry.name === "page.tsx") {
      out.push(relative);
    }
  }
  return out;
}

function labelFromPath(assistantPath: string): string {
  const labels: Record<string, string> = {
    "/": "Application",
    "/bdr": "Boîte de réception",
    "/bdr/:id": "Détail d'un message",
    "/trt": "Traité",
    "/hist": "Historique",
    "/flt": "Filtres",
    "/auto": "Automate",
    "/reg": "Réglages",
    "/doc": "Documentation",
    "/users": "Utilisateurs",
    "/login": "Connexion",
    "/setup": "Initialisation",
  };
  return labels[assistantPath] ?? assistantPath;
}

function descriptionFromPath(assistantPath: string): string {
  const descriptions: Record<string, string> = {
    "/": "Vue d'ensemble des sections fonctionnelles de l'application.",
    "/bdr": "Consulter les messages reçus, les filtrer et déclencher des actions.",
    "/bdr/:id": "Lire le contenu complet d'un message et ses métadonnées.",
    "/trt": "Consulter les messages déjà traités ou archivés.",
    "/hist": "Suivre les événements techniques et métiers des flux mails.",
    "/flt": "Créer et maintenir les filtres utilisés par les automatisations.",
    "/auto": "Définir et piloter les automatisations de traitement des messages.",
    "/reg": "Configurer boîte cloud, raccourcis, SMTP et options avancées.",
    "/doc": "Documentation fonctionnelle de l'application.",
    "/users": "Administration des comptes utilisateurs.",
    "/login": "Authentification utilisateur.",
    "/setup": "Configuration initiale de l'instance.",
  };
  return descriptions[assistantPath] ?? `Section ${assistantPath}.`;
}

function inferAccessLevel(canonicalPath: string): AppAccessLevel {
  if (canonicalPath === "/login" || canonicalPath === "/setup") {
    return "public";
  }
  if (canonicalPath === "/utilisateurs") {
    return "admin";
  }
  return "auth";
}

export async function extractRouteNodes(): Promise<AppDetailNode[]> {
  const pageFiles = await collectPageFiles(APP_ROOT_DIR);
  const byCanonical = new Map<string, RouteShape>();

  for (const rel of pageFiles) {
    const canonical = toCanonicalPathFromFile(rel);
    if (!canonical) continue;
    const existing = byCanonical.get(canonical);
    if (existing) {
      if (!existing.source.includes("app-routes")) {
        existing.source.push("app-routes");
      }
    } else {
      byCanonical.set(canonical, { canonicalPath: canonical, source: ["app-routes"] });
    }
  }

  for (const sidebarPath of SIDEBAR_PATHS) {
    const existing = byCanonical.get(sidebarPath);
    if (existing) {
      if (!existing.source.includes("sidebar")) {
        existing.source.push("sidebar");
      }
    } else {
      byCanonical.set(sidebarPath, { canonicalPath: sidebarPath, source: ["sidebar"] });
    }
  }

  for (const step of TUTORIAL_STEPS) {
    const candidates = [step.pathPrefix, step.navigateOnNext].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    for (const candidate of candidates) {
      const existing = byCanonical.get(candidate);
      if (existing) {
        if (!existing.source.includes("tutorial")) {
          existing.source.push("tutorial");
        }
      } else {
        byCanonical.set(candidate, { canonicalPath: candidate, source: ["tutorial"] });
      }
    }
  }

  return Array.from(byCanonical.values())
    .map((route): AppDetailNode => {
      const assistantPath = toAssistantPath(route.canonicalPath);
      return {
        path: assistantPath,
        label: labelFromPath(assistantPath),
        description: descriptionFromPath(assistantPath),
        kind: "section",
        access: inferAccessLevel(route.canonicalPath),
        aliases: assistantPath === route.canonicalPath ? [] : [route.canonicalPath],
        children: [],
        source: route.source,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
