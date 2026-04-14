-- AlterTable
ALTER TABLE "InboundMessage" ADD COLUMN     "hiddenFromTransferList" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SmtpOutboundSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
