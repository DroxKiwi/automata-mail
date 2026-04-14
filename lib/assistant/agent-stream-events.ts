/**
 * Événements NDJSON émis par `POST /api/assistant/agent` (un JSON par ligne).
 * Fichier sans dépendance serveur pour import côté client.
 */
export type AgentStreamPendingMutation = {
  token: string;
  summary: string;
  kind: string;
} | null;

export type AgentStreamEvent =
  | { type: "thinking_delta"; text: string }
  | { type: "content_delta"; text: string }
  | { type: "content_final"; text: string }
  | { type: "stream_reset" }
  | {
      type: "tool";
      tool: string;
      label: string;
      ok: boolean;
      palette: string;
    }
  | {
      type: "done";
      reply: string;
      navigation: string | null;
      pendingMutation: AgentStreamPendingMutation;
    }
  | { type: "error"; message: string };
