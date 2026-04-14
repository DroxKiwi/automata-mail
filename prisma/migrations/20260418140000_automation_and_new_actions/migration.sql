-- AlterEnum (PostgreSQL : ajout en fin de type)
ALTER TYPE "RuleActionType" ADD VALUE 'ARCHIVE';
ALTER TYPE "RuleActionType" ADD VALUE 'AUTO_REPLY';

-- CreateTable
CREATE TABLE "Automation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationOnFilter" (
    "automationId" INTEGER NOT NULL,
    "filterId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationOnFilter_pkey" PRIMARY KEY ("automationId","filterId")
);

-- CreateIndex
CREATE INDEX "Automation_enabled_priority_idx" ON "Automation"("enabled", "priority");

-- CreateIndex
CREATE INDEX "AutomationOnFilter_automationId_idx" ON "AutomationOnFilter"("automationId");

-- AddForeignKey
ALTER TABLE "AutomationOnFilter" ADD CONSTRAINT "AutomationOnFilter_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationOnFilter" ADD CONSTRAINT "AutomationOnFilter_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "Filter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Rule" ADD COLUMN "automationId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Rule_automationId_key" ON "Rule"("automationId");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
