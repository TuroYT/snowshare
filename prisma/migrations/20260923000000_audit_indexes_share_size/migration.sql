-- DropIndex
DROP INDEX "Share_ownerId_idx";

-- DropIndex
DROP INDEX "ShareFile_shareId_idx";

-- DropIndex
DROP INDEX "ShareAccessLog_shareId_idx";

-- AlterTable
ALTER TABLE "Share" ADD COLUMN     "size" BIGINT;

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Share_ownerId_createdAt_idx" ON "Share"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ShareFile_shareId_relativePath_idx" ON "ShareFile"("shareId", "relativePath");

-- CreateIndex
CREATE INDEX "ShareAccessLog_shareId_accessedAt_idx" ON "ShareAccessLog"("shareId", "accessedAt");

