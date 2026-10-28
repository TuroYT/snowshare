-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpLastCounter" INTEGER,
ADD COLUMN     "totpSecret" TEXT;
