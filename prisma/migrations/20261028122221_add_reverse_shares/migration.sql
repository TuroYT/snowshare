-- CreateTable
CREATE TABLE "ReverseShare" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxUploads" INTEGER,
    "maxSizeMB" INTEGER,
    "uploadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReverseShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReverseShare_slug_key" ON "ReverseShare"("slug");

-- CreateIndex
CREATE INDEX "ReverseShare_ownerId_createdAt_idx" ON "ReverseShare"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReverseShare" ADD CONSTRAINT "ReverseShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
