-- Multi-tenant by application user: backfill all existing data to main admin.
DO $$
DECLARE
  admin_id integer;
BEGIN
  SELECT id
  INTO admin_id
  FROM "User"
  ORDER BY "isAdmin" DESC, "createdAt" ASC, id ASC
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Cannot scope existing data: no user found.';
  END IF;

  ALTER TABLE "TransferShortcut" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "MailFlowEvent" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "InboundAddress" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "Filter" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "InboundMessage" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "Rule" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "AppMailboxSettings" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "OutlookOAuthSettings" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "SmtpOutboundSettings" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "OllamaSettings" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
  ALTER TABLE "GoogleOAuthSettings" ADD COLUMN IF NOT EXISTS "userId" INTEGER;

  UPDATE "TransferShortcut" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "MailFlowEvent" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "InboundAddress" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "Filter" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "Automation" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "InboundMessage" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "Rule" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "AppMailboxSettings" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "OutlookOAuthSettings" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "SmtpOutboundSettings" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "OllamaSettings" SET "userId" = admin_id WHERE "userId" IS NULL;
  UPDATE "GoogleOAuthSettings" SET "userId" = admin_id WHERE "userId" IS NULL;
END $$;

ALTER TABLE "TransferShortcut" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "MailFlowEvent" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "InboundAddress" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Filter" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Automation" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "InboundMessage" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Rule" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AppMailboxSettings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "OutlookOAuthSettings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "SmtpOutboundSettings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "OllamaSettings" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "GoogleOAuthSettings" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "AppMailboxSettings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "OutlookOAuthSettings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "SmtpOutboundSettings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "OllamaSettings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "GoogleOAuthSettings" ALTER COLUMN "id" DROP DEFAULT;

DROP SEQUENCE IF EXISTS "AppMailboxSettings_id_seq";
CREATE SEQUENCE "AppMailboxSettings_id_seq";
SELECT setval('"AppMailboxSettings_id_seq"', COALESCE((SELECT MAX(id) FROM "AppMailboxSettings"), 1), true);
ALTER TABLE "AppMailboxSettings" ALTER COLUMN "id" SET DEFAULT nextval('"AppMailboxSettings_id_seq"');

DROP SEQUENCE IF EXISTS "OutlookOAuthSettings_id_seq";
CREATE SEQUENCE "OutlookOAuthSettings_id_seq";
SELECT setval('"OutlookOAuthSettings_id_seq"', COALESCE((SELECT MAX(id) FROM "OutlookOAuthSettings"), 1), true);
ALTER TABLE "OutlookOAuthSettings" ALTER COLUMN "id" SET DEFAULT nextval('"OutlookOAuthSettings_id_seq"');

DROP SEQUENCE IF EXISTS "SmtpOutboundSettings_id_seq";
CREATE SEQUENCE "SmtpOutboundSettings_id_seq";
SELECT setval('"SmtpOutboundSettings_id_seq"', COALESCE((SELECT MAX(id) FROM "SmtpOutboundSettings"), 1), true);
ALTER TABLE "SmtpOutboundSettings" ALTER COLUMN "id" SET DEFAULT nextval('"SmtpOutboundSettings_id_seq"');

DROP SEQUENCE IF EXISTS "OllamaSettings_id_seq";
CREATE SEQUENCE "OllamaSettings_id_seq";
SELECT setval('"OllamaSettings_id_seq"', COALESCE((SELECT MAX(id) FROM "OllamaSettings"), 1), true);
ALTER TABLE "OllamaSettings" ALTER COLUMN "id" SET DEFAULT nextval('"OllamaSettings_id_seq"');

DROP SEQUENCE IF EXISTS "GoogleOAuthSettings_id_seq";
CREATE SEQUENCE "GoogleOAuthSettings_id_seq";
SELECT setval('"GoogleOAuthSettings_id_seq"', COALESCE((SELECT MAX(id) FROM "GoogleOAuthSettings"), 1), true);
ALTER TABLE "GoogleOAuthSettings" ALTER COLUMN "id" SET DEFAULT nextval('"GoogleOAuthSettings_id_seq"');

DROP INDEX IF EXISTS "InboundAddress_localPart_domain_key";
CREATE UNIQUE INDEX "InboundAddress_userId_localPart_domain_key"
ON "InboundAddress"("userId", "localPart", "domain");

DROP INDEX IF EXISTS "InboundMessage_gmailMessageId_key";
CREATE UNIQUE INDEX "InboundMessage_userId_gmailMessageId_key"
ON "InboundMessage"("userId", "gmailMessageId");

DROP INDEX IF EXISTS "InboundMessage_outlookMessageId_key";
CREATE UNIQUE INDEX "InboundMessage_userId_outlookMessageId_key"
ON "InboundMessage"("userId", "outlookMessageId");

CREATE UNIQUE INDEX IF NOT EXISTS "AppMailboxSettings_userId_key" ON "AppMailboxSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "OutlookOAuthSettings_userId_key" ON "OutlookOAuthSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "SmtpOutboundSettings_userId_key" ON "SmtpOutboundSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "OllamaSettings_userId_key" ON "OllamaSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleOAuthSettings_userId_key" ON "GoogleOAuthSettings"("userId");

CREATE INDEX IF NOT EXISTS "TransferShortcut_userId_createdAt_idx" ON "TransferShortcut"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "MailFlowEvent_userId_createdAt_idx" ON "MailFlowEvent"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "InboundAddress_userId_isActive_idx" ON "InboundAddress"("userId","isActive");
CREATE INDEX IF NOT EXISTS "Filter_userId_enabled_priority_idx" ON "Filter"("userId","enabled","priority");
CREATE INDEX IF NOT EXISTS "Automation_userId_enabled_priority_idx" ON "Automation"("userId","enabled","priority");
CREATE INDEX IF NOT EXISTS "InboundMessage_userId_receivedAt_idx" ON "InboundMessage"("userId","receivedAt");
CREATE INDEX IF NOT EXISTS "InboundMessage_userId_archived_receivedAt_idx" ON "InboundMessage"("userId","archived","receivedAt");
CREATE INDEX IF NOT EXISTS "Rule_userId_enabled_priority_idx" ON "Rule"("userId","enabled","priority");

ALTER TABLE "TransferShortcut"
  ADD CONSTRAINT "TransferShortcut_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailFlowEvent"
  ADD CONSTRAINT "MailFlowEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundAddress"
  ADD CONSTRAINT "InboundAddress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Filter"
  ADD CONSTRAINT "Filter_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Automation"
  ADD CONSTRAINT "Automation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundMessage"
  ADD CONSTRAINT "InboundMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rule"
  ADD CONSTRAINT "Rule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppMailboxSettings"
  ADD CONSTRAINT "AppMailboxSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutlookOAuthSettings"
  ADD CONSTRAINT "OutlookOAuthSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmtpOutboundSettings"
  ADD CONSTRAINT "SmtpOutboundSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OllamaSettings"
  ADD CONSTRAINT "OllamaSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleOAuthSettings"
  ADD CONSTRAINT "GoogleOAuthSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
