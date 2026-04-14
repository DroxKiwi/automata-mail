-- CreateTable
CREATE TABLE "TransferShortcut" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferShortcut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferShortcut_userId_email_key" ON "TransferShortcut"("userId", "email");

-- CreateIndex
CREATE INDEX "TransferShortcut_userId_idx" ON "TransferShortcut"("userId");

-- AddForeignKey
ALTER TABLE "TransferShortcut" ADD CONSTRAINT "TransferShortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
