-- AlterTable
ALTER TABLE "Share" ADD COLUMN "isBulk" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShareFile" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "relativePath" TEXT,
    "size" BIGINT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShareFile" ADD CONSTRAINT "ShareFile_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;
