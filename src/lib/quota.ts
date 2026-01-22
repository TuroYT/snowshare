import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { getClientIp } from "./getClientIp";
import { convertFromMB, getUnitLabel } from "./formatSize";

/**
 * Get file size in MB from file path
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size / (1024 * 1024); // Convert to MB
  } catch {
    return 0;
  }
}

/**
 * Calculate total upload size for an IP address
 */
async function calculateIpUploadSize(ipAddress: string): Promise<number> {
  const shares = await prisma.share.findMany({
    where: {
      ipSource: ipAddress,
      type: "FILE",
      filePath: { not: null },
    },
    select: {
      filePath: true,
    },
  });

  let totalSize = 0;
  for (const share of shares) {
    if (share.filePath) {
      const fullPath = path.join(process.cwd(), share.filePath);
      totalSize += await getFileSize(fullPath);
    }
  }

  return totalSize;
}

/**
 * Check if upload is allowed based on quotas
 * Returns { allowed: boolean, reason?: string, currentUsage?: number, limit?: number }
 */
export async function checkUploadQuota(
  request: NextRequest,
  fileSize: number
): Promise<{
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}> {
  // Get settings
  const settings = await prisma.settings.findFirst();
  if (!settings) {
    // No settings found, allow upload with defaults
    return { allowed: true };
  }

  // Check if user is authenticated
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;

  // Get IP address
  const ipAddress = getClientIp(request);

  // Determine limits based on authentication status
  const maxFileSize = isAuthenticated
    ? settings.authMaxUpload
    : settings.anoMaxUpload;
  const ipQuota = isAuthenticated
    ? settings.authIpQuota
    : settings.anoIpQuota;
  const useGiBForDisplay = isAuthenticated
    ? settings.useGiBForAuth
    : settings.useGiBForAnon;

  const unitLabel = getUnitLabel(useGiBForDisplay);
  const maxFileSizeDisplay = convertFromMB(maxFileSize, useGiBForDisplay);
  const ipQuotaDisplay = convertFromMB(ipQuota, useGiBForDisplay);

  // Check individual file size
  if (fileSize > maxFileSize) {
    return {
      allowed: false,
      reason: isAuthenticated
        ? `File size exceeds maximum allowed (${maxFileSizeDisplay}${unitLabel})`
        : `File size exceeds maximum allowed (${maxFileSizeDisplay}${unitLabel}). Sign in for higher limits.`,
      limit: maxFileSize,
    };
  }

  // Calculate current usage for this IP
  const currentUsage = await calculateIpUploadSize(ipAddress);

  // Check if adding this file would exceed quota
  if (currentUsage + fileSize > ipQuota) {
    const currentUsageDisplay = convertFromMB(currentUsage, useGiBForDisplay);
    return {
      allowed: false,
      reason: isAuthenticated
        ? `IP quota exceeded. Current usage: ${currentUsageDisplay} ${unitLabel}, Limit: ${ipQuotaDisplay} ${unitLabel}`
        : `IP quota exceeded. Current usage: ${currentUsageDisplay} ${unitLabel}, Limit: ${ipQuotaDisplay} ${unitLabel}. Sign in for higher limits.`,
      currentUsage,
      limit: ipQuota,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit: ipQuota,
  };
}

/**
 * Get quota information for display
 */
export async function getQuotaInfo(request: NextRequest): Promise<{
  maxFileSize: number;
  ipQuota: number;
  currentUsage: number;
  remainingQuota: number;
  isAuthenticated: boolean;
  useGiB: boolean;
}> {
  const settings = await prisma.settings.findFirst();
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;
  const ipAddress = getClientIp(request);

  const maxFileSize = isAuthenticated
    ? settings?.authMaxUpload || 51200
    : settings?.anoMaxUpload || 2048;
  const ipQuota = isAuthenticated
    ? settings?.authIpQuota || 102400
    : settings?.anoIpQuota || 4096;
  const useGiB = isAuthenticated
    ? settings?.useGiBForAuth ?? false
    : settings?.useGiBForAnon ?? false;

  const currentUsage = await calculateIpUploadSize(ipAddress);
  const remainingQuota = Math.max(0, ipQuota - currentUsage);

  return {
    maxFileSize,
    ipQuota,
    currentUsage,
    remainingQuota,
    isAuthenticated,
    useGiB,
  };
}
