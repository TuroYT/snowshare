-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "captchaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "captchaProvider" TEXT;
ALTER TABLE "Settings" ADD COLUMN "captchaSiteKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN "captchaSecretKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN "smtpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "Settings" ADD COLUMN "smtpPort" INTEGER DEFAULT 587;
ALTER TABLE "Settings" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "Settings" ADD COLUMN "smtpPassword" TEXT;
ALTER TABLE "Settings" ADD COLUMN "smtpFrom" TEXT;
ALTER TABLE "Settings" ADD COLUMN "smtpSecure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;
