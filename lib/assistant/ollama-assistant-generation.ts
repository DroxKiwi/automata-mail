import type { ResolvedOllamaConfig } from "@/lib/ollama/ollama-config";

/**
 * Valeurs par défaut si la ligne BDD est absente (migrations) — alignées sur Prisma `OllamaSettings`.
 */
export const OLLAMA_ASSISTANT_GENERATION_DEFAULTS = {
  thinkingEnabled: false,
  optionsEnabled: true,
  temperature: 1.0,
  top_p: 0.95,
  top_k: 64,
} as const;

/**
 * Objet à fusionner dans le corps JSON Ollama sous `options`, ou `undefined` si désactivé en réglages.
 */
export function ollamaAssistantGenerationOptionsFromResolved(
  cfg: ResolvedOllamaConfig,
):
  | { temperature: number; top_p: number; top_k: number }
  | undefined {
  if (!cfg.assistantOptionsEnabled) return undefined;
  return {
    temperature: cfg.assistantTemperature,
    top_p: cfg.assistantTopP,
    top_k: cfg.assistantTopK,
  };
}
