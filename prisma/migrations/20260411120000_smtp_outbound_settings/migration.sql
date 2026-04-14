-- CreateTable
CREATE TABLE "SmtpOutboundSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "authUser" TEXT,
    "authPassword" TEXT,
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmtpOutboundSettings_pkey" PRIMARY KEY ("id")
);
