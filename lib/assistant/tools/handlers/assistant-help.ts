import { toolsCatalogForHelp } from "@/lib/assistant/tools/registry";
import type { ToolHandler } from "@/lib/assistant/tools/handler-types";

export const assistantHelpHandler: ToolHandler = async (_args, ctx) => {
  const tools = toolsCatalogForHelp(ctx.isAdmin).map((t) => ({
    name: t.name,
    risk: t.risk,
    adminOnly: t.adminOnly,
    summary: t.summary,
    parameters: t.parameters,
  }));
  return {
    ok: true,
    data: {
      tools,
      note: "Use these exact names in tool_calls[].name.",
    },
    navigation: null,
  };
};
