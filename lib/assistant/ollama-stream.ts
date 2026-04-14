import type { AgentChatMessage } from "@/lib/assistant/agent-messages";
import { ollamaAssistantGenerationOptionsFromResolved } from "@/lib/assistant/ollama-assistant-generation";
import type { ResolvedOllamaConfig } from "@/lib/ollama/ollama-config";

export type OllamaStreamTurn = {
  content: string;
  raw: Record<string, unknown>;
};

export type OllamaStreamDeltaHandler = (part: {
  thinkingDelta: string | null;
  contentDelta: string | null;
}) => void;

function parseNdjsonLines(
  buffer: string,
): { lines: string[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  return { lines, rest };
}

/**
 * Un tour de chat Ollama en streaming (deltas). Agrège content / thinking / tool_calls du dernier message.
 * `think` suit les réglages BDD (`assistantThinkingEnabled`).
 */
export async function ollamaChatStreamOnce(
  cfg: ResolvedOllamaConfig,
  messages: AgentChatMessage[],
  signal: AbortSignal | undefined,
  onDelta: OllamaStreamDeltaHandler,
): Promise<OllamaStreamTurn> {
  const url = `${cfg.baseUrl}/api/chat`;
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  if (cfg.apiKey) {
    headers.set("X-API-Key", cfg.apiKey);
  }

  const genOpts = ollamaAssistantGenerationOptionsFromResolved(cfg);
  const withOptions = (extra: Record<string, unknown>) =>
    genOpts ? { ...extra, options: genOpts } : extra;

  const useThink = cfg.assistantThinkingEnabled === true;
  const bodyWithThink = (): Record<string, unknown> => {
    const core: Record<string, unknown> = {
      model: cfg.model,
      messages,
      stream: true,
    };
    if (useThink) core.think = true;
    return withOptions(core);
  };

  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyWithThink()),
    cache: "no-store",
    signal,
  });

  if (!res.ok && res.status === 400) {
    const errText = await res.text().catch(() => "");
    if (useThink && /think/i.test(errText)) {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(
          withOptions({
            model: cfg.model,
            messages,
            stream: true,
          }),
        ),
        cache: "no-store",
        signal,
      });
    } else {
      throw new Error(
        errText.trim().slice(0, 400) || `Ollama returned HTTP 400.`,
      );
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text.trim().slice(0, 400) || `Ollama returned HTTP ${res.status}.`,
    );
  }

  if (!res.body) {
    throw new Error("Ollama response had no body.");
  }

  let aggContent = "";
  let aggThinking = "";
  let lastDoneMessage: Record<string, unknown> | null = null;

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  if (signal) {
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const { lines, rest } = parseNdjsonLines(buf);
      buf = rest;
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(t) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (data.done === true && data.message && typeof data.message === "object") {
          lastDoneMessage = data.message as Record<string, unknown>;
        }
        const msg = data.message;
        if (!msg || typeof msg !== "object") continue;
        const m = msg as Record<string, unknown>;
        const th = m.thinking;
        if (typeof th === "string" && th.length > 0) {
          let d = th;
          if (aggThinking.length > 0 && th.startsWith(aggThinking)) {
            d = th.slice(aggThinking.length);
            aggThinking = th;
          } else if (aggThinking.length === 0) {
            aggThinking = th;
          } else {
            aggThinking += th;
          }
          if (d) onDelta({ thinkingDelta: d, contentDelta: null });
        }
        const c = m.content;
        if (typeof c === "string" && c.length > 0) {
          let d = c;
          if (aggContent.length > 0 && c.startsWith(aggContent)) {
            d = c.slice(aggContent.length);
            aggContent = c;
          } else if (aggContent.length === 0) {
            aggContent = c;
          } else {
            aggContent += c;
          }
          if (d) onDelta({ thinkingDelta: null, contentDelta: d });
        }
      }
    }
    if (buf.trim()) {
      try {
        const data = JSON.parse(buf.trim()) as Record<string, unknown>;
        if (data.done === true && data.message && typeof data.message === "object") {
          lastDoneMessage = data.message as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  /** Ollama met souvent `message.content` vide sur le dernier chunk (`done: true`) : le texte est uniquement dans les deltas. */
  const lastMsgContent =
    typeof lastDoneMessage?.content === "string" ? lastDoneMessage.content : "";
  const lastMsgThinking =
    typeof lastDoneMessage?.thinking === "string"
      ? lastDoneMessage.thinking
      : "";
  const mergedContent =
    lastMsgContent.length > 0 ? lastMsgContent : aggContent;
  const mergedThinking =
    lastMsgThinking.length > 0 ? lastMsgThinking : aggThinking;

  const raw: Record<string, unknown> = {
    content: mergedContent,
    thinking: mergedThinking,
  };
  const tc = lastDoneMessage?.tool_calls;
  if (Array.isArray(tc) && tc.length > 0) {
    raw.tool_calls = tc;
  }

  const content =
    typeof raw.content === "string" ? raw.content : String(raw.content ?? "");

  return { content, raw };
}
