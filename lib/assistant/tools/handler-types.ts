import type { AssistantSessionContext } from "@/lib/assistant/session-types";

export type PendingMutationNotice = {
  token: string;
  summary: string;
  kind: "archive_inbox_message";
};

export type ToolExecutionResult =
  | {
      ok: true;
      data: unknown;
      navigation: string | null;
      pendingMutation?: PendingMutationNotice;
    }
  | { ok: false; error: string; navigation: null };

export type ToolHandler = (args: unknown, ctx: AssistantSessionContext) => Promise<ToolExecutionResult>;
