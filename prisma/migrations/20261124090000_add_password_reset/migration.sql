-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "resetEmailHtml" TEXT,
ADD COLUMN     "resetEmailSubject" TEXT,
ADD COLUMN     "resetEmailText" TEXT;
