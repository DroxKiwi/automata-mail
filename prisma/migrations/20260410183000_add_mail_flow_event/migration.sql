-- CreateTable
CREATE TABLE "MailFlowEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT NOT NULL,
    "userId" INTEGER,
    "actor" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,

    CONSTRAINT "MailFlowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailFlowEvent_userId_createdAt_idx" ON "MailFlowEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MailFlowEvent_correlationId_idx" ON "MailFlowEvent"("correlationId");

-- CreateIndex
CREATE INDEX "MailFlowEvent_createdAt_idx" ON "MailFlowEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "MailFlowEvent" ADD CONSTRAINT "MailFlowEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
