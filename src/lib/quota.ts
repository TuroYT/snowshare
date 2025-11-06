import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

/**
 * Extract IP address from request, checking X-Forwarded-For header first
 */
export function getClientIp(request: NextRequest): string {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Fallback to unknown (NextRequest doesn't expose IP directly)
  return "unknown";
}

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

  // Check individual file size
  if (fileSize > maxFileSize) {
    return {
      allowed: false,
      reason: isAuthenticated
        ? `File size exceeds maximum allowed (${maxFileSize} MB)`
        : `File size exceeds maximum allowed (${maxFileSize} MB). Sign in for higher limits.`,
      limit: maxFileSize,
    };
  }

  // Calculate current usage for this IP
  const currentUsage = await calculateIpUploadSize(ipAddress);

  // Check if adding this file would exceed quota
  if (currentUsage + fileSize > ipQuota) {
    return {
      allowed: false,
      reason: isAuthenticated
        ? `IP quota exceeded. Current usage: ${currentUsage.toFixed(2)} MB, Limit: ${ipQuota} MB`
        : `IP quota exceeded. Current usage: ${currentUsage.toFixed(2)} MB, Limit: ${ipQuota} MB. Sign in for higher limits.`,
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

  const currentUsage = await calculateIpUploadSize(ipAddress);
  const remainingQuota = Math.max(0, ipQuota - currentUsage);

  return {
    maxFileSize,
    ipQuota,
    currentUsage,
    remainingQuota,
    isAuthenticated,
  };
}
