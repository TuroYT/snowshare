import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";

export async function logShareAccess(request: NextRequest, shareId: string) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    await prisma.shareAccessLog.create({
      data: { shareId, ip, userAgent },
    });
    lookupIpGeolocation(ip);
  } catch {
    // Non-blocking: logging errors must not break share access
  }
}
