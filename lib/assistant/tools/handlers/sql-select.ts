import { asRecord } from "@/lib/assistant/tools/args";
import { executeAssistantSqlSelect } from "@/lib/assistant/sql-read/execute";
import type { ToolHandler } from "@/lib/assistant/tools/handler-types";

export const sqlSelectHandler: ToolHandler = async (args, ctx) => {
  const o = asRecord(args) ?? {};
  const query = typeof o.query === "string" ? o.query : "";
  if (!query.trim()) {
    return {
      ok: false,
      error: "sql_select requires query (non-empty SQL string).",
      navigation: null,
    };
  }
  const result = await executeAssistantSqlSelect(query, ctx.isAdmin);
  if (!result.ok) {
    return { ok: false, error: result.error, navigation: null };
  }
  return {
    ok: true,
    data: {
      rows: result.rows,
      rowCount: result.rowCount,
      truncated: result.truncated,
    },
    navigation: null,
  };
};
