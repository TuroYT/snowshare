-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "emailDefaultLocale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "shareEmailSubject" TEXT,
ADD COLUMN "shareEmailHtml" TEXT,
ADD COLUMN "shareEmailText" TEXT,
ADD COLUMN "verifyEmailSubject" TEXT,
ADD COLUMN "verifyEmailHtml" TEXT,
ADD COLUMN "verifyEmailText" TEXT;
