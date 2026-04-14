-- CreateTable
CREATE TABLE "Filter" (
    "id" SERIAL NOT NULL,
    "inboundAddressId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterCondition" (
    "id" SERIAL NOT NULL,
    "filterId" INTEGER NOT NULL,
    "field" "RuleField" NOT NULL,
    "headerName" TEXT,
    "operator" "RuleOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Filter_enabled_priority_idx" ON "Filter"("enabled", "priority");

-- CreateIndex
CREATE INDEX "Filter_inboundAddressId_idx" ON "Filter"("inboundAddressId");

-- CreateIndex
CREATE INDEX "FilterCondition_filterId_idx" ON "FilterCondition"("filterId");

-- AddForeignKey
ALTER TABLE "Filter" ADD CONSTRAINT "Filter_inboundAddressId_fkey" FOREIGN KEY ("inboundAddressId") REFERENCES "InboundAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilterCondition" ADD CONSTRAINT "FilterCondition_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "Filter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
