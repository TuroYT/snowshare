-- DropForeignKey
ALTER TABLE "public"."Share" DROP CONSTRAINT "Share_ownerId_fkey";

-- AlterTable
ALTER TABLE "public"."Share" ALTER COLUMN "ownerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Share" ADD CONSTRAINT "Share_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
