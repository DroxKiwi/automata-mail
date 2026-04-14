export const CANONICAL_TO_ASSISTANT_PATH: Record<string, string> = {
  "/": "/",
  "/boite": "/bdr",
  "/boite/:id": "/bdr/:id",
  "/transfere": "/trt",
  "/historique": "/hist",
  "/filtres": "/flt",
  "/automate": "/auto",
  "/reglages": "/reg",
  "/documentation": "/doc",
  "/utilisateurs": "/users",
  "/login": "/login",
  "/setup": "/setup",
};

const ASSISTANT_TO_CANONICAL_PATH = Object.entries(CANONICAL_TO_ASSISTANT_PATH).reduce<
  Record<string, string>
>((acc, [canonical, assistantPath]) => {
  acc[assistantPath] = canonical;
  return acc;
}, {});

export function toAssistantPath(path: string): string {
  return CANONICAL_TO_ASSISTANT_PATH[path] ?? path;
}

export function toCanonicalPath(path: string): string {
  return ASSISTANT_TO_CANONICAL_PATH[path] ?? path;
}

export function normalizeDetailPath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "/";
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}
