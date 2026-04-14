-- Boite de reception : trace par message, lu/non lu, pieces jointes (metadonnees).

-- AlterTable
ALTER TABLE "InboundMessage" ADD COLUMN "correlationId" TEXT,
ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InboundMessage_correlationId_idx" ON "InboundMessage"("correlationId");

-- CreateTable
CREATE TABLE "InboundAttachment" (
    "id" SERIAL NOT NULL,
    "inboundMessageId" INTEGER NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "contentId" TEXT,
    "disposition" TEXT,

    CONSTRAINT "InboundAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundAttachment_inboundMessageId_idx" ON "InboundAttachment"("inboundMessageId");

-- AddForeignKey
ALTER TABLE "InboundAttachment" ADD CONSTRAINT "InboundAttachment_inboundMessageId_fkey" FOREIGN KEY ("inboundMessageId") REFERENCES "InboundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
