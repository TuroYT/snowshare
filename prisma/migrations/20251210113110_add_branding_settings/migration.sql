-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "appName" TEXT NOT NULL DEFAULT 'SnowShare',
ADD COLUMN "appDescription" TEXT NOT NULL DEFAULT 'Partagez vos fichiers, pastes et URLs en toute sécurité',
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "faviconUrl" TEXT,
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#8B5CF6';
