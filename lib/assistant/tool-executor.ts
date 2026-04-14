import { normalizeAndValidateNavigationPath } from "@/lib/assistant/allowed-paths";
import { inboundMessageExistsForBoiteDetail } from "@/lib/boite/boite-messages";
import {
  requestArchiveInboxMessage,
} from "@/lib/assistant/archive-inbox-request";
import { executeAssistantSqlSelect } from "@/lib/assistant/sql-read/execute";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";
import {
  toolAllowedForUser,
  toolDefinition,
  toolsCatalogForHelp,
} from "@/lib/assistant/tools/registry";

export type { AssistantSessionContext };

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

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asMessageId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 1 ? n : null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (/^[1-9]\d*$/.test(t)) return parseInt(t, 10);
  }
  return null;
}

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

  switch (trimmed) {
    case "sql_select": {
      const o = asRecord(args) ?? {};
      const query = typeof o.query === "string" ? o.query : "";
      if (!query.trim()) {
        return {
          ok: false,
          error: "sql_select requires query (non-empty SQL string).",
          navigation: null,
        };
      }
      const r = await executeAssistantSqlSelect(query, ctx.isAdmin);
      if (!r.ok) {
        return { ok: false, error: r.error, navigation: null };
      }
      return {
        ok: true,
        data: {
          rows: r.rows,
          rowCount: r.rowCount,
          truncated: r.truncated,
        },
        navigation: null,
      };
    }
    case "assistant_help": {
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
    }
    case "navigate_app": {
      const o = asRecord(args) ?? {};
      const pathRaw = o.path;
      if (typeof pathRaw !== "string") {
        return {
          ok: false,
          error: "navigate_app requires path (string).",
          navigation: null,
        };
      }
      const path = normalizeAndValidateNavigationPath(pathRaw);
      if (!path) {
        return {
          ok: false,
          error: `Path not allowed: ${pathRaw.slice(0, 120)}`,
          navigation: null,
        };
      }
      const boiteDetail = /^\/boite\/([1-9]\d*)$/.exec(path);
      if (boiteDetail) {
        const messageId = Number.parseInt(boiteDetail[1], 10);
        const exists = await inboundMessageExistsForBoiteDetail(messageId);
        if (!exists) {
          return {
            ok: false,
            error: `No openable message at /boite/${messageId} (unknown id or inactive address). Use only "InboundMessage"."id" from sql_select — never invent an id (e.g. 1 for "first").`,
            navigation: null,
          };
        }
      }
      return {
        ok: true,
        data: { opened: path },
        navigation: path,
      };
    }
    case "request_archive_inbox_message": {
      const o = asRecord(args) ?? {};
      const id = asMessageId(o.id);
      if (id === null) {
        return {
          ok: false,
          error: "request_archive_inbox_message requires id (message).",
          navigation: null,
        };
      }
      const r = await requestArchiveInboxMessage({
        userId: ctx.userId,
        messageId: id,
      });
      if (!r.ok) {
        return { ok: false, error: r.error, navigation: null };
      }
      return {
        ok: true,
        data: {
          mustConfirm: r.mustConfirm,
          expiresInMinutes: r.expiresInMinutes,
          summary: r.summary,
          instruction:
            "The user must click « Confirmer » in the assistant panel to apply the archive.",
        },
        navigation: null,
        pendingMutation: {
          token: r.token,
          summary: r.summary,
          kind: "archive_inbox_message",
        },
      };
    }
    default:
      return {
        ok: false,
        error: `Unknown tool: ${trimmed}`,
        navigation: null,
      };
  }
}
