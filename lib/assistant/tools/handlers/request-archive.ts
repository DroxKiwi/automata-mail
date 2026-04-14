import { requestArchiveInboxMessage } from "@/lib/assistant/archive-inbox-request";
import { asPositiveInt, asRecord } from "@/lib/assistant/tools/args";
import type { ToolHandler } from "@/lib/assistant/tools/handler-types";

export const requestArchiveInboxMessageHandler: ToolHandler = async (args, ctx) => {
  const o = asRecord(args) ?? {};
  const id = asPositiveInt(o.id);
  if (id === null) {
    return {
      ok: false,
      error: "request_archive_inbox_message requires id (message).",
      navigation: null,
    };
  }
  const result = await requestArchiveInboxMessage({
    userId: ctx.userId,
    messageId: id,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, navigation: null };
  }
  return {
    ok: true,
    data: {
      mustConfirm: result.mustConfirm,
      expiresInMinutes: result.expiresInMinutes,
      summary: result.summary,
      instruction: "The user must click « Confirmer » in the assistant panel to apply the archive.",
    },
    navigation: null,
    pendingMutation: {
      token: result.token,
      summary: result.summary,
      kind: "archive_inbox_message",
    },
  };
};
