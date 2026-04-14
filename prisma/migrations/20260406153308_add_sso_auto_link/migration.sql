-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ssoAutoLink" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Share_ipSource_idx" ON "Share"("ipSource");

-- CreateIndex
CREATE INDEX "Share_ownerId_idx" ON "Share"("ownerId");

-- CreateIndex
CREATE INDEX "Share_expiresAt_idx" ON "Share"("expiresAt");

-- CreateIndex
CREATE INDEX "Share_createdAt_idx" ON "Share"("createdAt");
