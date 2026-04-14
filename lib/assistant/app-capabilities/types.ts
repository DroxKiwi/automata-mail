import type { CloudMailboxProvider } from "@prisma/client";

export type ApplicationCapabilities = {
  user: {
    id: number;
    isAdmin: boolean;
  };
  mailbox: {
    activeProvider: CloudMailboxProvider;
    cloudConnected: boolean;
    canSyncCloudInbox: boolean;
  };
  channels: {
    available: Array<"gmail" | "outlook" | "smtp">;
    priority: Array<"gmail" | "outlook" | "smtp">;
    hasAnySendChannel: boolean;
  };
  google: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasRedirectUri: boolean;
    hasRefreshToken: boolean;
  };
  outlook: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasRedirectUri: boolean;
    hasTenantId: boolean;
    hasRefreshToken: boolean;
  };
  smtp: {
    isConfigured: boolean;
    hasAuthUser: boolean;
    hasAuthPassword: boolean;
  };
  assistant: {
    ollamaConfigured: boolean;
    hasModel: boolean;
    usesAdminFallbackConfig: boolean;
  };
};

export type SanitizedApplicationCapabilities = ApplicationCapabilities;
