-- CreateEnum
CREATE TYPE "CloudMailboxProvider" AS ENUM ('NONE', 'GOOGLE', 'OUTLOOK');

-- CreateTable
CREATE TABLE "AppMailboxSettings" (
    "id" INTEGER NOT NULL,
    "activeProvider" "CloudMailboxProvider" NOT NULL DEFAULT 'NONE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppMailboxSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutlookOAuthSettings" (
    "id" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT,
    "redirectUri" TEXT NOT NULL DEFAULT '',
    "tenantId" TEXT NOT NULL DEFAULT 'common',
    "refreshToken" TEXT,
    "outlookPollIntervalSeconds" INTEGER NOT NULL DEFAULT 0,
    "outlookSyncUnreadOnly" BOOLEAN NOT NULL DEFAULT true,
    "outlookMarkReadOnOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutlookOAuthSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InboundMessage" ADD COLUMN "outlookMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_outlookMessageId_key" ON "InboundMessage"("outlookMessageId");

-- Seed singletons
INSERT INTO "AppMailboxSettings" ("id", "activeProvider", "updatedAt")
VALUES (1, 'NONE', CURRENT_TIMESTAMP);

INSERT INTO "OutlookOAuthSettings" ("id", "clientId", "redirectUri", "tenantId", "outlookPollIntervalSeconds", "outlookSyncUnreadOnly", "outlookMarkReadOnOpen", "updatedAt")
VALUES (1, '', '', 'common', 0, true, false, CURRENT_TIMESTAMP);

-- Backfill : comptes déjà connectés à Gmail → fournisseur Google
UPDATE "AppMailboxSettings"
SET "activeProvider" = 'GOOGLE'
WHERE EXISTS (
    SELECT 1 FROM "GoogleOAuthSettings" g
    WHERE g."id" = 1
      AND g."refreshToken" IS NOT NULL
      AND btrim(g."refreshToken") <> ''
);
