import { asRecord } from "@/lib/assistant/tools/args";
import { resolveApplicationDetail } from "@/lib/assistant/app-detail/service";
import type { ToolHandler } from "@/lib/assistant/tools/handler-types";

export const applicationDetailHandler: ToolHandler = async (args, ctx) => {
  const o = asRecord(args) ?? {};
  const path = typeof o.path === "string" ? o.path : undefined;
  const depth =
    typeof o.depth === "number"
      ? o.depth
      : typeof o.depth === "string"
        ? Number.parseInt(o.depth, 10)
        : undefined;
  const detail = await resolveApplicationDetail({ path, depth }, ctx);
  return {
    ok: true,
    data: detail,
    navigation: null,
  };
};
