/**
 * Centralized IP quota calculation.
 * Used by: upload/route.ts, upload/bulk/route.ts, quota.ts, and server.js (via dynamic import).
 */

import { prisma } from "@/lib/prisma";
import { getStorageFileSize } from "@/lib/storage";

/**
 * Calculate total upload size in bytes for an IP address.
 * Bulk uploads use sizes stored in DB; single-file uploads stat the local file or query S3.
 */
export async function calculateIpUploadSizeBytes(ipAddress: string): Promise<number> {
  const shares = await prisma.share.findMany({
    where: {
      ipSource: ipAddress,
      type: "FILE",
    },
    select: {
      filePath: true,
      isBulk: true,
      files: { select: { size: true } },
    },
  });

  let totalSize = 0;

  for (const share of shares) {
    if (share.isBulk && share.files?.length > 0) {
      for (const file of share.files) {
        totalSize += Number(file.size);
      }
    } else if (share.filePath) {
      try {
        totalSize += await getStorageFileSize(share.filePath);
      } catch {
        // File missing — skip
      }
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
  const settings = await prisma.settings.findFirst();

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
