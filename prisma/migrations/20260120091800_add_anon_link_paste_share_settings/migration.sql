-- AlterTable
ALTER TABLE "public"."Settings" ADD COLUMN     "allowAnonLinkShare" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."Settings" ADD COLUMN     "allowAnonPasteShare" BOOLEAN NOT NULL DEFAULT true;
