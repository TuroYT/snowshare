-- CreateTable
CREATE TABLE "ShareAccessLog" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShareAccessLog_shareId_idx" ON "ShareAccessLog"("shareId");

-- CreateIndex
CREATE INDEX "ShareAccessLog_ip_idx" ON "ShareAccessLog"("ip");

-- AddForeignKey
ALTER TABLE "ShareAccessLog" ADD CONSTRAINT "ShareAccessLog_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;
