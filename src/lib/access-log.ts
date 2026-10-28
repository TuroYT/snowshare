import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import { getRetryAfter, recordRateLimitHit } from "@/lib/rate-limit";
import { sendAccessNotificationEmail } from "@/lib/email";

const SHARE_PREFIX = { FILE: "f", PASTE: "p", URL: "l" } as const;

const NOTIFY_INTERVAL_MS = 60 * 60 * 1000;

/**
 * E-mails the share owner when they opted in: at most once per share per hour (persisted, so
 * it holds across restarts and instances) and at most 20 per owner per hour.
 */
export async function notifyShareOwner(shareId: string, accessedAt = new Date()) {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: {
      slug: true,
      type: true,
      ownerId: true,
      owner: { select: { email: true, notifyOnAccess: true } },
    },
  });
  if (!share?.ownerId || !share.owner?.notifyOnAccess) return false;
  // Check the owner budget first so an exhausted budget never burns this share's hourly slot
  if (getRetryAfter("accessNotification", share.ownerId) > 0) return false;

  // Claim the hourly slot atomically: concurrent accesses can't both send
  const claimed = await prisma.share.updateMany({
    where: {
      id: shareId,
      OR: [
        { lastAccessNotifiedAt: null },
        { lastAccessNotifiedAt: { lt: new Date(accessedAt.getTime() - NOTIFY_INTERVAL_MS) } },
      ],
    },
    data: { lastAccessNotifiedAt: accessedAt },
  });
  if (claimed.count === 0) return false;
  recordRateLimitHit("accessNotification", share.ownerId);

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const shareUrl = `${baseUrl}/${SHARE_PREFIX[share.type]}/${share.slug}`;
  try {
    if (await sendAccessNotificationEmail(share.owner.email, shareUrl, accessedAt)) return true;
  } catch (error) {
    console.error("Failed to send share access notification:", error);
  }
  // Not sent: free the slot so the next access can retry
  await prisma.share.updateMany({
    where: { id: shareId, lastAccessNotifiedAt: accessedAt },
    data: { lastAccessNotifiedAt: null },
  });
  return false;
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
