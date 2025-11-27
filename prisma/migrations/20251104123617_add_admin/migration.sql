/*
  Warnings:

  - The values [PLAIN,CSHARP,RUBY,SWIFT,KOTLIN,BASH] on the enum `pasteType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "pasteType_new" AS ENUM ('PLAINTEXT', 'JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'PHP', 'GO', 'HTML', 'CSS', 'SQL', 'JSON', 'MARKDOWN');
ALTER TABLE "Share" ALTER COLUMN "pastelanguage" TYPE "pasteType_new" USING ("pastelanguage"::text::"pasteType_new");
ALTER TYPE "pasteType" RENAME TO "pasteType_old";
ALTER TYPE "pasteType_new" RENAME TO "pasteType";
DROP TYPE "public"."pasteType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Share" ADD COLUMN     "ipSource" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "allowSignin" BOOLEAN NOT NULL DEFAULT true,
    "anoMaxUpload" INTEGER NOT NULL DEFAULT 2048,
    "authMaxUpload" INTEGER NOT NULL DEFAULT 51200,
    "anoIpQuota" INTEGER NOT NULL DEFAULT 4096,
    "authIpQuota" INTEGER NOT NULL DEFAULT 102400,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
