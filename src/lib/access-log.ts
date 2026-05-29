import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";

export async function logShareAccess(request: NextRequest, shareId: string) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    await prisma.shareAccessLog.create({
      data: { shareId, ip, userAgent },
    });
  } catch {
    // Non-blocking: logging errors must not break share access
  }
}
