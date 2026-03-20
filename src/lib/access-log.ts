import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import { NextRequest } from "next/server";

/**
 * Log a share access (view/download) with the visitor's IP and user agent.
 * Fire-and-forget — does not block the caller.
 */
export function logShareAccess(request: NextRequest, shareId: string): void {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || null;

  prisma.shareAccessLog
    .create({
      data: {
        shareId,
        ip,
        userAgent,
      },
    })
    .then(() => {
      lookupIpGeolocation(ip);
    })
    .catch((err) => {
      console.error("[AccessLog] Failed to log access:", err);
    });
}
