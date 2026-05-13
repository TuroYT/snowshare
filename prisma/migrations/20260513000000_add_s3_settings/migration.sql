-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "s3Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "s3Endpoint" TEXT;
ALTER TABLE "Settings" ADD COLUMN "s3Region" TEXT;
ALTER TABLE "Settings" ADD COLUMN "s3Bucket" TEXT;
ALTER TABLE "Settings" ADD COLUMN "s3AccessKeyId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "s3SecretAccessKey" TEXT;
