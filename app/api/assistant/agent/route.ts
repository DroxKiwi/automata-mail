import { normalizeAgentChatMessages } from "@/lib/assistant/agent-messages";
import { runAssistantAgentLoopStreaming } from "@/lib/assistant/agent-loop";
import type { AgentStreamEvent } from "@/lib/assistant/agent-stream-events";
import { assistantRequestOriginError } from "@/lib/assistant/request-guard";
import { getSessionUser } from "@/lib/auth";
import { getOllamaConfig } from "@/lib/ollama/ollama-config";

const NDJSON_TYPE = "application/x-ndjson; charset=utf-8";

/**
 * Assistant avec outils : réponse en NDJSON (une ligne JSON par événement).
 * Deltas : content_delta (éventuellement thinking_delta si le modèle en envoie) ; outils : tool ; fin : done.
 */
export async function POST(request: Request) {
  const originErr = assistantRequestOriginError(request);
  if (originErr) {
    return new Response(
      JSON.stringify({ type: "error", message: originErr } satisfies AgentStreamEvent) + "\n",
      { status: 403, headers: { "Content-Type": NDJSON_TYPE } },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return new Response(
      JSON.stringify({ type: "error", message: "Non authentifie." } satisfies AgentStreamEvent) +
        "\n",
      { status: 401, headers: { "Content-Type": NDJSON_TYPE } },
    );
  }

  const cfg = await getOllamaConfig();
  if (!cfg?.model) {
    return new Response(
      JSON.stringify({
        type: "error",
        message: "Ollama non configure ou modele absent.",
      } satisfies AgentStreamEvent) + "\n",
      { status: 400, headers: { "Content-Type": NDJSON_TYPE } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "error", message: "JSON invalide." } satisfies AgentStreamEvent) +
        "\n",
      { status: 400, headers: { "Content-Type": NDJSON_TYPE } },
    );
  }

  if (typeof body !== "object" || body === null || !("messages" in body)) {
    return new Response(
      JSON.stringify({ type: "error", message: "messages[] requis." } satisfies AgentStreamEvent) +
        "\n",
      { status: 400, headers: { "Content-Type": NDJSON_TYPE } },
    );
  }

  const messages = normalizeAgentChatMessages(
    (body as { messages: unknown }).messages,
  );
  if (!messages) {
    return new Response(
      JSON.stringify({
        type: "error",
        message: "messages[] invalide ou trop volumineux.",
      } satisfies AgentStreamEvent) + "\n",
      { status: 400, headers: { "Content-Type": NDJSON_TYPE } },
    );
  }

  const ac = request.signal;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
      };
      try {
        await runAssistantAgentLoopStreaming(cfg, messages, ac, {
          userId: user.id,
          isAdmin: user.isAdmin,
        }, send);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          send({ type: "error", message: "Annule." });
        } else {
          const msg = e instanceof Error ? e.message : "Erreur inconnue.";
          send({ type: "error", message: msg });
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": NDJSON_TYPE,
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
