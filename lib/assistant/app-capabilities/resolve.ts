import type { ApplicationCapabilities } from "@/lib/assistant/app-capabilities/types";
import { prisma } from "@/lib/db/prisma";
import { getGmailOAuth2ConfigFromDb } from "@/lib/gmail/oauth";
import { getActiveCloudProvider } from "@/lib/mailbox/provider";
import { getOllamaConfig, getOllamaConfigForChat } from "@/lib/ollama/ollama-config";
import { getOutlookOAuthAppConfigFromDb } from "@/lib/outlook/oauth";
import { getOutboundSmtpConfig } from "@/lib/smtp/smtp-config";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";

export async function resolveApplicationCapabilities(
  ctx: AssistantSessionContext,
): Promise<ApplicationCapabilities> {
  const [activeProvider, googleRow, outlookRow, smtpRow, ollamaOwn, ollamaForChat, googleCfg, outlookCfg] =
    await Promise.all([
      getActiveCloudProvider(ctx.userId),
      prisma.googleOAuthSettings.findUnique({ where: { userId: ctx.userId } }),
      prisma.outlookOAuthSettings.findUnique({ where: { userId: ctx.userId } }),
      getOutboundSmtpConfig(ctx.userId),
      getOllamaConfig(ctx.userId),
      getOllamaConfigForChat(ctx.userId),
      getGmailOAuth2ConfigFromDb(ctx.userId),
      getOutlookOAuthAppConfigFromDb(ctx.userId),
    ]);

  const googleHasRefresh = Boolean(googleRow?.refreshToken?.trim());
  const outlookHasRefresh = Boolean(outlookRow?.refreshToken?.trim());
  const canUseGoogleMailbox = activeProvider === "GOOGLE" && googleHasRefresh;
  const canUseOutlookMailbox = activeProvider === "OUTLOOK" && outlookHasRefresh;
  const cloudConnected = canUseGoogleMailbox || canUseOutlookMailbox;

  const availableChannels: Array<"gmail" | "outlook" | "smtp"> = [];
  if (canUseGoogleMailbox) {
    availableChannels.push("gmail");
  }
  if (canUseOutlookMailbox) {
    availableChannels.push("outlook");
  }
  if (smtpRow) {
    availableChannels.push("smtp");
  }

  return {
    user: {
      id: ctx.userId,
      isAdmin: ctx.isAdmin,
    },
    mailbox: {
      activeProvider,
      cloudConnected,
      canSyncCloudInbox: cloudConnected,
    },
    channels: {
      available: availableChannels,
      priority: ["gmail", "outlook", "smtp"],
      hasAnySendChannel: availableChannels.length > 0,
    },
    google: {
      hasClientId: Boolean(googleCfg?.clientId?.trim()),
      hasClientSecret: Boolean(googleCfg?.clientSecret?.trim()),
      hasRedirectUri: Boolean(googleCfg?.redirectUri?.trim()),
      hasRefreshToken: googleHasRefresh,
    },
    outlook: {
      hasClientId: Boolean(outlookCfg?.clientId?.trim()),
      hasClientSecret: Boolean(outlookCfg?.clientSecret?.trim()),
      hasRedirectUri: Boolean(outlookCfg?.redirectUri?.trim()),
      hasTenantId: Boolean(outlookCfg?.tenantId?.trim()),
      hasRefreshToken: outlookHasRefresh,
    },
    smtp: {
      isConfigured: smtpRow != null,
      hasAuthUser: Boolean(smtpRow?.user?.trim()),
      hasAuthPassword: Boolean(smtpRow?.pass?.trim()),
    },
    assistant: {
      ollamaConfigured: ollamaForChat != null,
      hasModel: Boolean(ollamaForChat?.model?.trim()),
      usesAdminFallbackConfig: ollamaOwn == null && ollamaForChat != null,
    },
  };
}
