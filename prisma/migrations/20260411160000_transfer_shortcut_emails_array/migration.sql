-- Migrate single email per row to Postgres text array
ALTER TABLE "TransferShortcut" ADD COLUMN "emails" TEXT[];

UPDATE "TransferShortcut" SET "emails" = ARRAY[email]::TEXT[];

ALTER TABLE "TransferShortcut" ALTER COLUMN "emails" SET NOT NULL;

DROP INDEX "TransferShortcut_userId_email_key";

ALTER TABLE "TransferShortcut" DROP COLUMN "email";
