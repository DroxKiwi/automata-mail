import { resolveApplicationCapabilities } from "@/lib/assistant/app-capabilities/resolve";
import { sanitizeCapabilitiesForRole } from "@/lib/assistant/app-capabilities/sanitize";
import type { ToolHandler } from "@/lib/assistant/tools/handler-types";

export const applicationCapabilitiesHandler: ToolHandler = async (_args, ctx) => {
  const resolved = await resolveApplicationCapabilities(ctx);
  const sanitized = sanitizeCapabilitiesForRole(resolved, ctx.isAdmin);
  return {
    ok: true,
    data: sanitized,
    navigation: null,
  };
};
