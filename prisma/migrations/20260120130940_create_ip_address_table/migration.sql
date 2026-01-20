-- CreateTable
CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_ip_key" ON "IpAddress"("ip");

-- AlterTable
ALTER TABLE "Share" DROP COLUMN "ipSource",
DROP COLUMN "ipCountry",
DROP COLUMN "ipCountryCode",
DROP COLUMN "ipRegion",
DROP COLUMN "ipCity",
ADD COLUMN "ipAddressId" TEXT;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_ipAddressId_fkey" FOREIGN KEY ("ipAddressId") REFERENCES "IpAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
