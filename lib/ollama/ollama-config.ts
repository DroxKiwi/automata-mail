import { prisma } from "@/lib/db/prisma";

export type ResolvedOllamaConfig = {
  baseUrl: string;
  apiKey: string | null;
  /** Modèle choisi dans les réglages (peut être vide). */
  model: string;
  assistantThinkingEnabled: boolean;
  assistantOptionsEnabled: boolean;
  assistantTemperature: number;
  assistantTopP: number;
  assistantTopK: number;
};

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Configuration Ollama persistée (singleton id = 1). Retourne null si l’URL de base est vide.
 */
export async function getOllamaConfig(userId: number): Promise<ResolvedOllamaConfig | null> {
  const row = await prisma.ollamaSettings.findUnique({
    where: { userId },
  });
  if (!row) {
    return null;
  }
  const baseUrl = normalizeBaseUrl(row.baseUrl);
  if (!baseUrl) {
    return null;
  }
  const key = row.apiKey?.trim();
  return {
    baseUrl,
    apiKey: key && key.length > 0 ? key : null,
    model: row.model?.trim() ?? "",
    assistantThinkingEnabled: Boolean(row.assistantThinkingEnabled),
    assistantOptionsEnabled: row.assistantOptionsEnabled !== false,
    assistantTemperature: Number(row.assistantTemperature ?? 1),
    assistantTopP: Number(row.assistantTopP ?? 0.95),
    assistantTopK: Math.trunc(Number(row.assistantTopK ?? 64)) || 64,
  };
}

/**
 * Résout la config utilisable par le chat:
 * - d'abord la config du user courant
 * - sinon la config du premier administrateur configuré
 */
export async function getOllamaConfigForChat(
  userId: number,
): Promise<ResolvedOllamaConfig | null> {
  const own = await getOllamaConfig(userId);
  if (own) {
    return own;
  }
  const adminRow = await prisma.ollamaSettings.findFirst({
    where: { user: { isAdmin: true } },
    orderBy: [{ userId: "asc" }],
  });
  if (!adminRow) {
    return null;
  }
  const baseUrl = normalizeBaseUrl(adminRow.baseUrl);
  if (!baseUrl) {
    return null;
  }
  const key = adminRow.apiKey?.trim();
  return {
    baseUrl,
    apiKey: key && key.length > 0 ? key : null,
    model: adminRow.model?.trim() ?? "",
    assistantThinkingEnabled: Boolean(adminRow.assistantThinkingEnabled),
    assistantOptionsEnabled: adminRow.assistantOptionsEnabled !== false,
    assistantTemperature: Number(adminRow.assistantTemperature ?? 1),
    assistantTopP: Number(adminRow.assistantTopP ?? 0.95),
    assistantTopK: Math.trunc(Number(adminRow.assistantTopK ?? 64)) || 64,
  };
}
