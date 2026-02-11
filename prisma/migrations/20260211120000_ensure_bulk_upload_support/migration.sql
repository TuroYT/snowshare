-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Share' AND column_name = 'isBulk'
    ) THEN
        ALTER TABLE "Share" ADD COLUMN "isBulk" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShareFile" (
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ShareFile_shareId_fkey'
    ) THEN
        ALTER TABLE "ShareFile" ADD CONSTRAINT "ShareFile_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShareFile_shareId_idx" ON "ShareFile"("shareId");
