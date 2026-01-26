-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smtpUser" TEXT,
ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpFromEmail" TEXT,
ADD COLUMN     "smtpFromName" TEXT,
ADD COLUMN     "captchaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "captchaProvider" TEXT,
ADD COLUMN     "captchaSiteKey" TEXT,
ADD COLUMN     "captchaSecretKey" TEXT;
