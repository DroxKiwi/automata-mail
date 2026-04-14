-- AlterTable
ALTER TABLE "InboundMessage" ADD COLUMN "rulesEvaluatedAt" TIMESTAMP(3);

-- Déjà traités par le moteur de règles (logs d’actions / skip)
UPDATE "InboundMessage" im
SET "rulesEvaluatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "MessageActionLog" mal WHERE mal."inboundMessageId" = im.id
);

-- CreateIndex
CREATE INDEX "InboundMessage_rulesEvaluatedAt_idx" ON "InboundMessage"("rulesEvaluatedAt");
