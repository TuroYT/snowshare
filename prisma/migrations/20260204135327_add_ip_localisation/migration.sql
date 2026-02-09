-- CreateTable
CREATE TABLE "IpLocalisation" (
    "ip" TEXT NOT NULL,
    "continentCode" TEXT,
    "continentName" TEXT,
    "countryCode" TEXT,
    "countryName" TEXT,
    "stateProv" TEXT,
    "city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpLocalisation_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE INDEX "ShareFile_shareId_idx" ON "ShareFile"("shareId");
