/*
  Warnings:

  - You are about to drop the column `accentColor` on the `Settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "accentColor",
ADD COLUMN     "backgroundColor" TEXT NOT NULL DEFAULT '#111827',
ADD COLUMN     "borderColor" TEXT NOT NULL DEFAULT '#374151',
ADD COLUMN     "primaryDark" TEXT NOT NULL DEFAULT '#1E40AF',
ADD COLUMN     "primaryHover" TEXT NOT NULL DEFAULT '#2563EB',
ADD COLUMN     "secondaryColor" TEXT NOT NULL DEFAULT '#8B5CF6',
ADD COLUMN     "secondaryDark" TEXT NOT NULL DEFAULT '#6D28D9',
ADD COLUMN     "secondaryHover" TEXT NOT NULL DEFAULT '#7C3AED',
ADD COLUMN     "surfaceColor" TEXT NOT NULL DEFAULT '#1F2937',
ADD COLUMN     "textColor" TEXT NOT NULL DEFAULT '#F9FAFB',
ADD COLUMN     "textMuted" TEXT NOT NULL DEFAULT '#D1D5DB';
