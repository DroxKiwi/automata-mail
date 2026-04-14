-- AlterTable
ALTER TABLE "InboundMessage" ADD COLUMN "gmailMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_gmailMessageId_key" ON "InboundMessage"("gmailMessageId");

-- AlterTable
ALTER TABLE "GoogleOAuthSettings" ADD COLUMN "gmailPollIntervalSeconds" INTEGER NOT NULL DEFAULT 0;
