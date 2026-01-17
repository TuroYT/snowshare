-- Add unit format preference columns to Settings
ALTER TABLE "Settings" ADD COLUMN "useGiBForAnon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "useGiBForAuth" BOOLEAN NOT NULL DEFAULT false;
