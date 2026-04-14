import type {
  ApplicationCapabilities,
  SanitizedApplicationCapabilities,
} from "@/lib/assistant/app-capabilities/types";

export function sanitizeCapabilitiesForRole(
  caps: ApplicationCapabilities,
  isAdmin: boolean,
): SanitizedApplicationCapabilities {
  if (isAdmin) {
    return caps;
  }
  return {
    ...caps,
    user: {
      ...caps.user,
      isAdmin: false,
    },
  };
}
