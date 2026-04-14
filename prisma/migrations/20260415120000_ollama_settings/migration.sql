-- CreateTable
CREATE TABLE "OllamaSettings" (
    "id" INTEGER NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OllamaSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "OllamaSettings" ("id", "baseUrl", "apiKey", "updatedAt")
VALUES (1, '', NULL, CURRENT_TIMESTAMP);
