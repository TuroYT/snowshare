-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "socialEmbedsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "embedPasteExcerpt" BOOLEAN NOT NULL DEFAULT false;
