-- CreateEnum
CREATE TYPE "RuleField" AS ENUM ('FROM', 'SUBJECT', 'BODY', 'HEADER');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('CONTAINS', 'EQUALS', 'STARTS_WITH', 'REGEX');

-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('FORWARD', 'REWRITE_SUBJECT', 'PREPEND_TEXT', 'DROP');

-- CreateEnum
CREATE TYPE "ActionLogStatus" AS ENUM ('MATCHED', 'SKIPPED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "InboundAddress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "localPart" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" SERIAL NOT NULL,
    "inboundAddressId" INTEGER NOT NULL,
    "messageIdHeader" TEXT,
    "mailFrom" TEXT NOT NULL,
    "rcptTo" JSONB NOT NULL,
    "subject" TEXT,
    "rawMime" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "headers" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "inboundAddressId" INTEGER,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleCondition" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "field" "RuleField" NOT NULL,
    "headerName" TEXT,
    "operator" "RuleOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleAction" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "type" "RuleActionType" NOT NULL,
    "config" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageActionLog" (
    "id" SERIAL NOT NULL,
    "inboundMessageId" INTEGER NOT NULL,
    "ruleId" INTEGER,
    "actionId" INTEGER,
    "status" "ActionLogStatus" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_localPart_domain_key" ON "InboundAddress"("localPart", "domain");

-- CreateIndex
CREATE INDEX "InboundAddress_userId_idx" ON "InboundAddress"("userId");

-- AddForeignKey
ALTER TABLE "InboundAddress" ADD CONSTRAINT "InboundAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_inboundAddressId_fkey" FOREIGN KEY ("inboundAddressId") REFERENCES "InboundAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "InboundMessage_inboundAddressId_receivedAt_idx" ON "InboundMessage"("inboundAddressId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundMessage_messageIdHeader_idx" ON "InboundMessage"("messageIdHeader");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_inboundAddressId_fkey" FOREIGN KEY ("inboundAddressId") REFERENCES "InboundAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Rule_userId_enabled_priority_idx" ON "Rule"("userId", "enabled", "priority");

-- CreateIndex
CREATE INDEX "Rule_inboundAddressId_idx" ON "Rule"("inboundAddressId");

-- AddForeignKey
ALTER TABLE "RuleCondition" ADD CONSTRAINT "RuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RuleCondition_ruleId_idx" ON "RuleCondition"("ruleId");

-- AddForeignKey
ALTER TABLE "RuleAction" ADD CONSTRAINT "RuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RuleAction_ruleId_order_idx" ON "RuleAction"("ruleId", "order");

-- AddForeignKey
ALTER TABLE "MessageActionLog" ADD CONSTRAINT "MessageActionLog_inboundMessageId_fkey" FOREIGN KEY ("inboundMessageId") REFERENCES "InboundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageActionLog" ADD CONSTRAINT "MessageActionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageActionLog" ADD CONSTRAINT "MessageActionLog_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RuleAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MessageActionLog_inboundMessageId_createdAt_idx" ON "MessageActionLog"("inboundMessageId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageActionLog_ruleId_idx" ON "MessageActionLog"("ruleId");

-- CreateIndex
CREATE INDEX "MessageActionLog_actionId_idx" ON "MessageActionLog"("actionId");
