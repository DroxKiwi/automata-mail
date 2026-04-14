import { randomBytes } from "crypto";

export type PendingMutationKind = "archive_inbox_message";

export type PendingMutationPayload = {
  userId: number;
  kind: PendingMutationKind;
  messageId: number;
  expiresAt: number;
};

const store = new Map<string, PendingMutationPayload>();

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function createPendingMutation(
  input: Omit<PendingMutationPayload, "expiresAt"> & { ttlMs?: number },
): string {
  const token = randomBytes(24).toString("hex");
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  store.set(token, {
    userId: input.userId,
    kind: input.kind,
    messageId: input.messageId,
    expiresAt: Date.now() + ttl,
  });
  return token;
}

/**
 * Consomme le jeton (usage unique). Vérifie l’utilisateur et l’expiration.
 */
export function consumePendingMutation(
  token: string,
  userId: number,
): PendingMutationPayload | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const p = store.get(trimmed);
  if (!p) return null;
  if (p.userId !== userId || Date.now() > p.expiresAt) {
    store.delete(trimmed);
    return null;
  }
  store.delete(trimmed);
  return p;
}
