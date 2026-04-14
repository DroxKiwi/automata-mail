import { normalizeAndValidateNavigationPath } from "@/lib/assistant/allowed-paths";
import { asRecord } from "@/lib/assistant/tools/args";
import { inboundMessageExistsForBoiteDetail } from "@/lib/boite/boite-messages";
import type { ToolHandler } from "@/lib/assistant/tools/handler-types";

export const navigateAppHandler: ToolHandler = async (args, ctx) => {
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
    const exists = await inboundMessageExistsForBoiteDetail(ctx.userId, messageId);
    if (!exists) {
      return {
        ok: false,
        error:
          `No openable message at /boite/${messageId} (unknown id or inactive address). ` +
          `Use only "InboundMessage"."id" from sql_select — never invent an id (e.g. 1 for "first").`,
        navigation: null,
      };
    }
  }
  return {
    ok: true,
    data: { opened: path },
    navigation: path,
  };
};
