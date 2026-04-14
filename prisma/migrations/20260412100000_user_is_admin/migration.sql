-- AlterTable
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Bases déjà peuplées : le premier compte (plus ancien createdAt) devient admin
UPDATE "User" u
SET "isAdmin" = true
WHERE u.id = (
  SELECT s.id FROM "User" s ORDER BY s."createdAt" ASC, s.id ASC LIMIT 1
);
