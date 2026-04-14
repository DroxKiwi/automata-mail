-- Espace mail / regles / raccourcis / journal : plus de lien vers User (comptes = auth + admin seulement).

-- MailFlowEvent
ALTER TABLE "MailFlowEvent" DROP CONSTRAINT IF EXISTS "MailFlowEvent_userId_fkey";
DROP INDEX IF EXISTS "MailFlowEvent_userId_createdAt_idx";
ALTER TABLE "MailFlowEvent" DROP COLUMN IF EXISTS "userId";

-- TransferShortcut
ALTER TABLE "TransferShortcut" DROP CONSTRAINT IF EXISTS "TransferShortcut_userId_fkey";
DROP INDEX IF EXISTS "TransferShortcut_userId_idx";
ALTER TABLE "TransferShortcut" DROP COLUMN IF EXISTS "userId";

-- Rule
ALTER TABLE "Rule" DROP CONSTRAINT IF EXISTS "Rule_userId_fkey";
DROP INDEX IF EXISTS "Rule_userId_enabled_priority_idx";
ALTER TABLE "Rule" DROP COLUMN IF EXISTS "userId";
CREATE INDEX IF NOT EXISTS "Rule_enabled_priority_idx" ON "Rule"("enabled", "priority");

-- InboundAddress
ALTER TABLE "InboundAddress" DROP CONSTRAINT IF EXISTS "InboundAddress_userId_fkey";
DROP INDEX IF EXISTS "InboundAddress_userId_idx";
ALTER TABLE "InboundAddress" DROP COLUMN IF EXISTS "userId";
