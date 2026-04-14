export type ToolRisk = "read" | "write" | "delete";

export type ToolDefinition = {
  name: string;
  summary: string;
  /** Argument description for the system prompt and assistant_help. */
  parameters: string;
  adminOnly: boolean;
  risk: ToolRisk;
};

/**
 * Single source of truth: tool names, permissions, and text injected into the system prompt.
 * Implementations live in tool-executor (no separate public HTTP executor route).
 */
export const ASSISTANT_TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: "assistant_help",
    summary:
      "Returns the catalog of tools available for this account (like a help command).",
    parameters: "No arguments.",
    adminOnly: false,
    risk: "read",
  },
  {
    name: "sql_select",
    summary:
      "Run a single read-only PostgreSQL SELECT (or WITH … SELECT). Primary way to read mail rows, counts, and related tables.",
    parameters:
      'query (string): one SQL statement; use double-quoted Prisma table names (e.g. "InboundMessage"). See system prompt for schema. Rows are capped server-side.',
    adminOnly: false,
    risk: "read",
  },
  {
    name: "navigate_app",
    summary:
      "Ask the client to open a page (message list or message detail).",
    parameters:
      'path: "/boite" or "/boite/ID" where ID is the exact "InboundMessage"."id" from sql_select. Do not invent IDs.',
    adminOnly: false,
    risk: "read",
  },
  {
    name: "request_archive_inbox_message",
    summary:
      "Prepare archiving a message: no immediate write; the human must confirm in the UI.",
    parameters: "id (integer, message to archive).",
    adminOnly: false,
    risk: "write",
  },
];

export function toolDefinition(name: string): ToolDefinition | undefined {
  return ASSISTANT_TOOL_REGISTRY.find((t) => t.name === name);
}

export function toolAllowedForUser(name: string, isAdmin: boolean): boolean {
  const def = toolDefinition(name);
  if (!def) return false;
  if (def.adminOnly && !isAdmin) return false;
  return true;
}

export function toolsPromptSection(isAdmin: boolean): string {
  let i = 0;
  const lines: string[] = [];
  for (const t of ASSISTANT_TOOL_REGISTRY) {
    if (t.adminOnly && !isAdmin) continue;
    i += 1;
    const badge =
      t.risk === "read"
        ? "read"
        : t.risk === "write"
          ? "write"
          : "delete";
    lines.push(
      `${i}) **${t.name}** (${badge}${t.adminOnly ? ", admin" : ""}) — ${t.summary}\n   ${t.parameters}`,
    );
  }
  return lines.join("\n\n");
}

export function toolsCatalogForHelp(isAdmin: boolean): ToolDefinition[] {
  return ASSISTANT_TOOL_REGISTRY.filter((t) => !t.adminOnly || isAdmin);
}
