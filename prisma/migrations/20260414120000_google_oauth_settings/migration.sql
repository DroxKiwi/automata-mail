-- CreateTable
CREATE TABLE "GoogleOAuthSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT,
    "redirectUri" TEXT NOT NULL DEFAULT '',
    "refreshToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleOAuthSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "GoogleOAuthSettings" ("id", "clientId", "redirectUri", "updatedAt")
VALUES (1, '', '', CURRENT_TIMESTAMP);
