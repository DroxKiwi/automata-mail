export type AgentChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const MAX_MESSAGES = 40;
const MAX_CONTENT_PER_MESSAGE = 48_000;

export function normalizeAgentChatMessages(
  raw: unknown,
): AgentChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AgentChatMessage[] = [];
  for (const m of raw) {
    if (
      typeof m !== "object" ||
      m === null ||
      typeof (m as { role?: unknown }).role !== "string" ||
      typeof (m as { content?: unknown }).content !== "string"
    ) {
      continue;
    }
    const role = (m as { role: string }).role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const content = (m as { content: string }).content;
    if (content.length > MAX_CONTENT_PER_MESSAGE) {
      return null;
    }
    out.push({ role, content });
  }
  if (out.length === 0) return null;
  if (out.length > MAX_MESSAGES) {
    return out.slice(-MAX_MESSAGES);
  }
  return out;
}
