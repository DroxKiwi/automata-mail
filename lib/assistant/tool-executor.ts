import type { AssistantSessionContext } from "@/lib/assistant/session-types";
import { applicationCapabilitiesHandler } from "@/lib/assistant/tools/handlers/application-capabilities";
import { applicationDetailHandler } from "@/lib/assistant/tools/handlers/application-detail";
import { assistantHelpHandler } from "@/lib/assistant/tools/handlers/assistant-help";
import { navigateAppHandler } from "@/lib/assistant/tools/handlers/navigate-app";
import { requestArchiveInboxMessageHandler } from "@/lib/assistant/tools/handlers/request-archive";
import { sqlSelectHandler } from "@/lib/assistant/tools/handlers/sql-select";
import type {
  PendingMutationNotice,
  ToolExecutionResult,
  ToolHandler,
} from "@/lib/assistant/tools/handler-types";
import {
  toolAllowedForUser,
  toolDefinition,
} from "@/lib/assistant/tools/registry";

export type { AssistantSessionContext };
export type { PendingMutationNotice, ToolExecutionResult };

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  assistant_help: assistantHelpHandler,
  sql_select: sqlSelectHandler,
  navigate_app: navigateAppHandler,
  request_archive_inbox_message: requestArchiveInboxMessageHandler,
  application_detail: applicationDetailHandler,
  application_capabilities: applicationCapabilitiesHandler,
};

export async function executeAssistantTool(
  name: string,
  args: unknown,
  ctx: AssistantSessionContext,
): Promise<ToolExecutionResult> {
  const trimmed = name.trim();
  if (!toolAllowedForUser(trimmed, ctx.isAdmin)) {
    const def = toolDefinition(trimmed);
    if (def?.adminOnly && !ctx.isAdmin) {
      return {
        ok: false,
        error: "Tool reserved for administrators.",
        navigation: null,
      };
    }
    return {
      ok: false,
      error: `Unknown or disallowed tool: ${trimmed}`,
      navigation: null,
    };
  }

  const handler = TOOL_HANDLERS[trimmed];
  if (!handler) {
    return {
      ok: false,
      error: `Unknown tool: ${trimmed}`,
      navigation: null,
    };
  }
  return handler(args, ctx);
}
