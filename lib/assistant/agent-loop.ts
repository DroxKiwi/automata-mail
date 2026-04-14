import type { AgentChatMessage } from "@/lib/assistant/agent-messages";
import { buildAgentSystemPrompt } from "@/lib/assistant/agent-system-prompt";
import { toolTagDisplayMeta } from "@/lib/assistant/tool-display";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";
import {
  executeAssistantTool,
  type PendingMutationNotice,
} from "@/lib/assistant/tool-executor";
import {
  ASSISTANT_THINKING_ONLY_BRIDGE_FR,
  FALLBACK_EMPTY_ASSISTANT_REPLY_FR,
} from "@/lib/assistant/fallback-copy";
import type { AgentStreamEvent } from "@/lib/assistant/agent-stream-events";
import { ollamaChatStreamOnce } from "@/lib/assistant/ollama-stream";
import { formatFriendlyToolCallsMessage } from "@/lib/assistant/tool-friendly-messages";
import type { ResolvedOllamaConfig } from "@/lib/ollama/ollama-config";

export type { AgentChatMessage };

type ToolCallsPayload = {
  tool_calls: Array<{ name: string; arguments: unknown }>;
};

const MAX_ITERATIONS = 8;

/** Après un premier lot d’outils en échec, nombre de tours « modèle + ré-exécution » supplémentaires avant abandon. */
const MAX_TOOL_RECOVERY_ATTEMPTS = 2;

const TOOL_FOLLOWUP_HINT =
  "Instructions: reply to the user in **French** with at least one clear sentence. If a tool failed (ok:false in the JSON), explain the error or limitation in French. After a successful navigate_app, confirm in French that the page was opened. Never return an empty or whitespace-only reply. If the user’s question is about mail or counts and you still lack data, call sql_select on \"InboundMessage\" (and joins if needed) before concluding.";

/** Relance si le modèle renvoie un tour vide (sans thinking côté API). */
const EMPTY_MODEL_RETRY_NUDGE =
  "[System] Your last reply was empty. Output EITHER only valid JSON: {\"tool_calls\":[{\"name\":\"…\",\"arguments\":{…}}]} with no other text, OR at least one helpful sentence in French. For mail/sender/count questions, call sql_select on \"InboundMessage\" first.";

function finalizeReply(reply: string, navigation: string | null): string {
  const t = reply.trim();
  if (t.length > 0) return t;
  if (navigation) {
    return `J’ai ouvert la page ${navigation} dans l’application. Tu peux y lire le message en entier.`;
  }
  return FALLBACK_EMPTY_ASSISTANT_REPLY_FR;
}

/** Corps principal du modèle vide mais trace thinking affichée → message ciblé (pas le gros fallback). */
function finalizeReplyWithThinkingAwareness(
  bodyRaw: string,
  hadThinkingUi: boolean,
  navigation: string | null,
): string {
  const body = bodyRaw.trim();
  if (body.length > 0) return finalizeReply(body, navigation);
  if (navigation) return finalizeReply("", navigation);
  if (hadThinkingUi) return ASSISTANT_THINKING_ONLY_BRIDGE_FR;
  return finalizeReply("", navigation);
}

const MAX_TOOL_RESULTS_MESSAGE_CHARS = 72_000;

function jsonStringifyToolSummary(toolName: string, payload: unknown): string {
  try {
    return JSON.stringify(
      payload,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      0,
    );
  } catch {
    return JSON.stringify({
      tool: toolName,
      ok: false,
      error: "Tool result could not be serialized (cycle or unsupported value).",
    });
  }
}

function truncateToolFollowupUserMessage(content: string): string {
  if (content.length <= MAX_TOOL_RESULTS_MESSAGE_CHARS) return content;
  return (
    content.slice(0, MAX_TOOL_RESULTS_MESSAGE_CHARS) +
    "\n\n[… tool results truncated for context limit; use narrower sql_select or fewer columns …]"
  );
}

function extractToolCalls(content: string): ToolCallsPayload | null {
  const trimmed = content.trim();
  const tryParse = (s: string): ToolCallsPayload | null => {
    try {
      const j = JSON.parse(s) as unknown;
      if (
        typeof j === "object" &&
        j !== null &&
        Array.isArray((j as ToolCallsPayload).tool_calls)
      ) {
        const tc = (j as ToolCallsPayload).tool_calls;
        if (
          tc.every(
            (x) =>
              typeof x === "object" &&
              x !== null &&
              typeof (x as { name?: unknown }).name === "string",
          )
        ) {
          return j as ToolCallsPayload;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const inner = tryParse(fence[1].trim());
    if (inner) return inner;
  }

  const obj = trimmed.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
  if (obj) {
    return tryParse(obj[0]);
  }

  return null;
}

/**
 * Suffixe `{"tool_calls":...}` (complet ou en cours de stream) à ne pas afficher dans le fil.
 */
function stripTrailingToolCallsJsonBlock(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] !== "{") continue;
    const tail = s.slice(i);
    if (!/"tool_calls"\s*:/.test(tail)) continue;
    const t = tail.trim();
    if (extractToolCalls(t) !== null) {
      return s.slice(0, i).trimEnd();
    }
    if (/^\s*\{\s*"tool_calls"\s*:\s*\[/.test(tail)) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

/**
 * Partie du contenu assistant à envoyer au client pendant le stream (masque le JSON d’outils).
 */
function assistantStreamVisiblePrefix(accumulated: string): string {
  const trimmedAll = accumulated.trim();
  if (trimmedAll.length > 0 && extractToolCalls(trimmedAll) !== null) {
    return "";
  }
  const ts = accumulated.trimStart();
  if (ts.startsWith("{")) {
    if (/"tool_calls"\s*:/.test(accumulated)) {
      return "";
    }
    if (!/"tool_calls"/.test(accumulated) && ts.length < 96) {
      return "";
    }
  }
  let s = stripTrailingToolCallsJsonBlock(accumulated);
  if (extractToolCalls(s.trim()) !== null) {
    return "";
  }
  return s;
}

function parseToolArgumentsField(raw: unknown): unknown {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return {};
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Ollama native tool_calls: [{ function: { name, arguments } }].
 * We normalize to the same shape as JSON-in-content tool_calls.
 */
function extractNativeOllamaToolCalls(msg: unknown): ToolCallsPayload | null {
  if (!msg || typeof msg !== "object") return null;
  const tc = (msg as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(tc) || tc.length === 0) return null;
  const out: { name: string; arguments: unknown }[] = [];
  for (const item of tc) {
    if (!item || typeof item !== "object") continue;
    const fn = (item as { function?: unknown }).function;
    if (!fn || typeof fn !== "object") continue;
    const name = (fn as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) continue;
    out.push({
      name: name.trim(),
      arguments: parseToolArgumentsField((fn as { arguments?: unknown }).arguments),
    });
  }
  return out.length > 0 ? { tool_calls: out } : null;
}

function resolveToolCallsPayload(
  content: string,
  apiMessage: unknown,
): ToolCallsPayload | null {
  const native = extractNativeOllamaToolCalls(apiMessage);
  if (native?.tool_calls?.length) return native;
  return extractToolCalls(content);
}

/** Trace affichée à part (police plus légère côté client) ; non renvoyée comme « réponse » principale. */
function thinkingTraceText(raw: Record<string, unknown>): string {
  const t = raw.thinking;
  if (typeof t === "string" && t.trim().length > 0) return t.trim();
  const r = raw.reasoning;
  if (typeof r === "string" && r.trim().length > 0) return r.trim();
  return "";
}

/** Texte principal : uniquement `content` (pas la trace thinking). */
function replyBodyFromMessage(raw: Record<string, unknown>): string {
  const c = raw.content;
  return typeof c === "string" ? c : "";
}

/**
 * La manche est exploitable si outils, ou texte de réponse, ou trace thinking
 * (évite une double tentative inutile quand seul thinking est rempli).
 */
function turnHasUsableModelOutput(
  content: string,
  raw: Record<string, unknown>,
  payload: ToolCallsPayload | null,
  calls: { name: string }[],
): boolean {
  if (payload && calls.length > 0) return true;
  if (content.trim().length > 0) return true;
  return thinkingTraceText(raw).length > 0;
}

function assistantTurnForHistory(
  content: string,
  payload: ToolCallsPayload,
): string {
  const t = content.trim();
  if (t.length > 0) return t;
  return JSON.stringify({
    tool_calls: payload.tool_calls.map((x) => ({
      name: x.name,
      arguments: x.arguments ?? {},
    })),
  });
}

function buildToolFailureRetryUserMessage(
  summaries: string[],
  attemptNumber: number,
  maxAttempts: number,
): string {
  return `[System / relance outil ${attemptNumber}/${maxAttempts}] Au moins un outil a renvoyé ok:false. Lis les lignes JSON ci-dessous. Réponds soit (1) **uniquement** avec du JSON valide {"tool_calls":[...]} avec des arguments corrigés (ex. refaire sql_select pour obtenir le vrai id numérique de "InboundMessage", puis navigate_app avec cet id exact), soit (2) une brève explication en **français** si tu ne peux pas corriger. Ne répète pas exactement le même appel en échec sans changement.\n\n${summaries.join("\n")}`;
}

async function streamOneAssistantTurn(
  cfg: ResolvedOllamaConfig,
  messages: AgentChatMessage[],
  signal: AbortSignal | undefined,
  emit: (event: AgentStreamEvent) => void,
): Promise<{ content: string; raw: Record<string, unknown> }> {
  let lastContent = "";
  let lastRaw: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    let contentAgg = "";
    let lastVisibleLen = 0;
    const turn = await ollamaChatStreamOnce(
      cfg,
      messages,
      signal,
      ({ thinkingDelta, contentDelta }) => {
        if (cfg.assistantThinkingEnabled && thinkingDelta) {
          emit({ type: "thinking_delta", text: thinkingDelta });
        }
        if (contentDelta) {
          contentAgg += contentDelta;
          const vis = assistantStreamVisiblePrefix(contentAgg);
          if (vis.length < lastVisibleLen) {
            lastVisibleLen = vis.length;
          }
          if (vis.length > lastVisibleLen) {
            emit({
              type: "content_delta",
              text: vis.slice(lastVisibleLen),
            });
            lastVisibleLen = vis.length;
          }
        }
      },
    );
    lastContent = turn.content;
    lastRaw = turn.raw;
    const payloadTry = resolveToolCallsPayload(turn.content, turn.raw);
    const callsTry =
      payloadTry?.tool_calls?.filter(
        (c) => typeof c.name === "string" && c.name.trim().length > 0,
      ) ?? [];
    if (
      turnHasUsableModelOutput(
        turn.content,
        turn.raw,
        payloadTry,
        callsTry,
      )
    ) {
      return turn;
    }
    if (attempt === 0) {
      messages.push({ role: "user", content: EMPTY_MODEL_RETRY_NUDGE });
    }
  }
  return { content: lastContent, raw: lastRaw };
}

export type { AgentStreamEvent };

/**
 * Boucle agent avec streaming Ollama vers le client via `emit` (NDJSON).
 */
export async function runAssistantAgentLoopStreaming(
  cfg: ResolvedOllamaConfig,
  conversation: AgentChatMessage[],
  signal: AbortSignal | undefined,
  session: AssistantSessionContext,
  emit: (event: AgentStreamEvent) => void,
): Promise<void> {
  const messages: AgentChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(session.isAdmin) },
    ...conversation.filter((m) => m.role !== "system"),
  ];

  let lastNavigation: string | null = null;
  let lastPendingMutation: PendingMutationNotice | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const turn = await streamOneAssistantTurn(cfg, messages, signal, emit);
    let assistantContent = turn.content;
    let rawAssistant: Record<string, unknown> = turn.raw;

    let payload = resolveToolCallsPayload(assistantContent, rawAssistant);

    let calls =
      payload?.tool_calls?.filter((c) => typeof c.name === "string" && c.name.trim().length > 0) ??
      [];

    const thinkUi = thinkingTraceText(rawAssistant);

    if (!payload || calls.length === 0) {
      const bodyRaw = replyBodyFromMessage(rawAssistant);
      const text = finalizeReplyWithThinkingAwareness(
        bodyRaw,
        thinkUi.length > 0,
        lastNavigation,
      );
      if (text !== bodyRaw.trim()) {
        emit({ type: "content_final", text });
      }
      emit({
        type: "done",
        reply: text,
        navigation: lastNavigation,
        pendingMutation: lastPendingMutation,
      });
      return;
    }

    let toolTurnContent = assistantContent;
    let toolPayload: ToolCallsPayload = payload;
    let toolCalls = calls;
    let failedRecoveryUsed = 0;

    while (true) {
      emit({
        type: "content_final",
        text: formatFriendlyToolCallsMessage(toolCalls),
      });

      messages.push({
        role: "assistant",
        content: assistantTurnForHistory(toolTurnContent, toolPayload),
      });

      const summaries: string[] = [];
      let anyFailure = false;
      for (const call of toolCalls) {
        const name = call.name.trim();
        const meta = toolTagDisplayMeta(name);
        const result = await executeAssistantTool(
          name,
          call.arguments ?? {},
          session,
        );
        emit({
          type: "tool",
          tool: name,
          label: meta.label,
          ok: result.ok,
          palette: meta.palette,
        });
        if (result.navigation) {
          lastNavigation = result.navigation;
        }
        if (result.ok && result.pendingMutation) {
          lastPendingMutation = result.pendingMutation;
        }
        if (!result.ok) anyFailure = true;
        summaries.push(
          jsonStringifyToolSummary(
            name,
            result.ok
              ? { tool: name, ok: true, result: result.data }
              : { tool: name, ok: false, error: result.error },
          ),
        );
      }

      if (!anyFailure) {
        messages.push({
          role: "user",
          content: truncateToolFollowupUserMessage(
            `Tool results (JSON):\n${summaries.join("\n")}\n\n${TOOL_FOLLOWUP_HINT}`,
          ),
        });
        emit({ type: "stream_reset" });
        break;
      }

      if (failedRecoveryUsed >= MAX_TOOL_RECOVERY_ATTEMPTS) {
        messages.push({
          role: "user",
          content: truncateToolFollowupUserMessage(
            `Tool results (JSON). Les relances automatiques après échec sont épuisées (${MAX_TOOL_RECOVERY_ATTEMPTS} tentative(s) de correction). Explique en **français** ce qui bloque, cite les erreurs ci-dessous, et indique quoi faire (ex. nouvelle requête sql_select pour le bon id, puis navigate_app).\n${summaries.join("\n")}\n\n${TOOL_FOLLOWUP_HINT}`,
          ),
        });
        emit({ type: "stream_reset" });
        break;
      }

      failedRecoveryUsed += 1;
      messages.push({
        role: "user",
        content: buildToolFailureRetryUserMessage(
          summaries,
          failedRecoveryUsed,
          MAX_TOOL_RECOVERY_ATTEMPTS,
        ),
      });

      const recoveryTurn = await streamOneAssistantTurn(
        cfg,
        messages,
        signal,
        emit,
      );
      toolTurnContent = recoveryTurn.content;
      rawAssistant = recoveryTurn.raw;

      const payloadRec = resolveToolCallsPayload(
        toolTurnContent,
        rawAssistant,
      );
      const callsRec =
        payloadRec?.tool_calls?.filter(
          (c) => typeof c.name === "string" && c.name.trim().length > 0,
        ) ?? [];

      if (!payloadRec || callsRec.length === 0) {
        const bodyRaw = replyBodyFromMessage(rawAssistant);
        const text = finalizeReplyWithThinkingAwareness(
          bodyRaw,
          thinkingTraceText(rawAssistant).length > 0,
          lastNavigation,
        );
        if (text !== bodyRaw.trim()) {
          emit({ type: "content_final", text });
        }
        emit({
          type: "done",
          reply: text,
          navigation: lastNavigation,
          pendingMutation: lastPendingMutation,
        });
        return;
      }

      toolPayload = payloadRec;
      toolCalls = callsRec;
    }
  }

  const text = finalizeReply(
    "Étape limite d’outils atteinte. Reformule en une question plus simple, ou demande « quels outils » / une requête **sql_select** sur « InboundMessage ».",
    lastNavigation,
  );
  emit({ type: "content_final", text });
  emit({
    type: "done",
    reply: text,
    navigation: lastNavigation,
    pendingMutation: lastPendingMutation,
  });
}
