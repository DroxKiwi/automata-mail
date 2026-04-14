-- AlterTable
ALTER TABLE "OllamaSettings" ADD COLUMN "assistantThinkingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OllamaSettings" ADD COLUMN "assistantOptionsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OllamaSettings" ADD COLUMN "assistantTemperature" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "OllamaSettings" ADD COLUMN "assistantTopP" DOUBLE PRECISION NOT NULL DEFAULT 0.95;
ALTER TABLE "OllamaSettings" ADD COLUMN "assistantTopK" INTEGER NOT NULL DEFAULT 64;
