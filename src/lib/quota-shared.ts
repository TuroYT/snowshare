/**
 * Centralized IP quota calculation.
 * Used by the upload routes, /api/quota and server.js (tus, via tsx).
 */

import { prisma } from "@/lib/prisma";
import { getStorageFileSize } from "@/lib/storage";
import { getSettingsCached } from "@/lib/settings";

/**
 * Calculate total upload size in bytes for an IP address, over shares that have not expired.
 *
 * Sizes come from the database (Share.size for single files, ShareFile.size for bulk
 * uploads) so the whole computation is two aggregate queries. Single-file shares created
 * before Share.size existed are measured once from storage and backfilled.
 */
export async function calculateIpUploadSizeBytes(ipAddress: string): Promise<number> {
  const notExpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  const shareWhere = { ipSource: ipAddress, type: "FILE" as const, ...notExpired };

  const [singleFiles, bulkFiles, legacyShares] = await Promise.all([
    prisma.share.aggregate({
      where: { ...shareWhere, isBulk: false },
      _sum: { size: true },
    }),
    prisma.shareFile.aggregate({
      where: { share: shareWhere },
      _sum: { size: true },
    }),
    prisma.share.findMany({
      where: { ...shareWhere, isBulk: false, size: null, filePath: { not: null } },
      select: { id: true, filePath: true },
    }),
  ]);

  let totalSize = Number(singleFiles._sum.size ?? 0) + Number(bulkFiles._sum.size ?? 0);

  for (const share of legacyShares) {
    if (!share.filePath) continue;
    try {
      const size = await getStorageFileSize(share.filePath);
      totalSize += size;
      await prisma.share.update({ where: { id: share.id }, data: { size: BigInt(size) } });
    } catch (error) {
      console.error(`Quota: cannot measure legacy share ${share.id}, not counted:`, error);
    }
  }

  return totalSize;
}

/**
 * Settings-based upload limits.
 */
export interface UploadLimits {
  maxFileSizeBytes: number;
  maxFileSizeMB: number;
  ipQuotaBytes: number;
  ipQuotaMB: number;
  currentUsageBytes: number;
  remainingQuotaBytes: number;
  isAuthenticated: boolean;
  useGiB: boolean;
}

/**
 * Get upload limits for a given IP and auth status.
 */
export async function getUploadLimits(
  ipAddress: string,
  isAuthenticated: boolean
): Promise<UploadLimits> {
  const settings = await getSettingsCached();

  const maxFileSizeMB = isAuthenticated
    ? settings?.authMaxUpload || 51200
    : settings?.anoMaxUpload || 2048;

  const ipQuotaMB = isAuthenticated
    ? settings?.authIpQuota || 102400
    : settings?.anoIpQuota || 4096;

  const useGiB = isAuthenticated
    ? (settings?.useGiBForAuth ?? false)
    : (settings?.useGiBForAnon ?? false);

  const currentUsageBytes = await calculateIpUploadSizeBytes(ipAddress);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  const ipQuotaBytes = ipQuotaMB * 1024 * 1024;
  const remainingQuotaBytes = Math.max(0, ipQuotaBytes - currentUsageBytes);

  return {
    maxFileSizeBytes,
    maxFileSizeMB,
    ipQuotaBytes,
    ipQuotaMB,
    currentUsageBytes,
    remainingQuotaBytes,
    isAuthenticated,
    useGiB,
  };
}
