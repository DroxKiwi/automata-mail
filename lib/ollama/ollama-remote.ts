import { getOllamaConfig } from "@/lib/ollama/ollama-config";

const TAGS_TIMEOUT_MS = 15_000;

/**
 * Interroge le serveur Ollama configuré : GET /api/tags, retourne les noms de modèles.
 */
export async function fetchOllamaModelNames(): Promise<string[]> {
  const cfg = await getOllamaConfig();
  if (!cfg) {
    throw new Error("OLLAMA_NOT_CONFIGURED");
  }

  const url = `${cfg.baseUrl}/api/tags`;
  const headers = new Headers({ Accept: "application/json" });
  if (cfg.apiKey) {
    headers.set("X-API-Key", cfg.apiKey);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TAGS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Ollama HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("models" in data) ||
      !Array.isArray((data as { models: unknown }).models)
    ) {
      return [];
    }
    const names: string[] = [];
    for (const m of (data as { models: unknown[] }).models) {
      if (
        typeof m === "object" &&
        m !== null &&
        "name" in m &&
        typeof (m as { name: unknown }).name === "string"
      ) {
        names.push((m as { name: string }).name);
      }
    }
    return names;
  } finally {
    clearTimeout(timer);
  }
}
