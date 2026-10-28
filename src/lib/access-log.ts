import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { sendAccessNotificationEmail } from "@/lib/email";

const SHARE_PREFIX = { FILE: "f", PASTE: "p", URL: "l" } as const;

/** E-mails the share owner when they opted in, at most once per share per hour. */
export async function notifyShareOwner(shareId: string, accessedAt = new Date()) {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: {
      slug: true,
      type: true,
      owner: { select: { email: true, notifyOnAccess: true } },
    },
  });
  if (!share?.owner?.notifyOnAccess) return false;
  if (consumeRateLimit("accessNotification", shareId) > 0) return false;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const shareUrl = `${baseUrl}/${SHARE_PREFIX[share.type]}/${share.slug}`;
  return sendAccessNotificationEmail(share.owner.email, shareUrl, accessedAt);
}

export async function logShareAccess(request: NextRequest, shareId: string) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    await prisma.shareAccessLog.create({
      data: { shareId, ip, userAgent },
    });
    lookupIpGeolocation(ip);
  } catch (error) {
    console.error("Failed to log share access:", error);
  }
  try {
    await notifyShareOwner(shareId);
  } catch (error) {
    console.error("Failed to send share access notification:", error);
  }
}
