-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DefaultTab" AS ENUM ('linkshare', 'pasteshare', 'fileshare');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultTab" "DefaultTab" NOT NULL DEFAULT 'linkshare';
