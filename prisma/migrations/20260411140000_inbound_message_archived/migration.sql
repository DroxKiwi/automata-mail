-- AlterTable
ALTER TABLE "InboundMessage" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "InboundMessage_inboundAddressId_archived_receivedAt_idx" ON "InboundMessage"("inboundAddressId", "archived", "receivedAt");
