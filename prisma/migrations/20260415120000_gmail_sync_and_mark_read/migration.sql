-- AlterTable
ALTER TABLE "GoogleOAuthSettings" ADD COLUMN "gmailSyncUnreadOnly" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GoogleOAuthSettings" ADD COLUMN "gmailMarkReadOnOpen" BOOLEAN NOT NULL DEFAULT false;
