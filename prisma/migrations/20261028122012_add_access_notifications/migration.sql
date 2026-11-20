-- AlterTable
ALTER TABLE "Share" ADD COLUMN     "lastAccessNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOnAccess" BOOLEAN NOT NULL DEFAULT false;
