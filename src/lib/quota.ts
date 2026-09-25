import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";
import { getUploadLimits } from "@/lib/quota-shared";

const BYTES_PER_MB = 1024 * 1024;

/**
 * Get quota information for display (sizes in MB).
 */
export async function getQuotaInfo(request: NextRequest): Promise<{
  maxFileSize: number;
  ipQuota: number;
  currentUsage: number;
  remainingQuota: number;
  isAuthenticated: boolean;
  useGiB: boolean;
}> {
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;
  const limits = await getUploadLimits(getClientIp(request), isAuthenticated);

  const currentUsage = limits.currentUsageBytes / BYTES_PER_MB;

  return {
    maxFileSize: limits.maxFileSizeMB,
    ipQuota: limits.ipQuotaMB,
    currentUsage,
    remainingQuota: Math.max(0, limits.ipQuotaMB - currentUsage),
    isAuthenticated,
    useGiB: limits.useGiB,
  };
}
