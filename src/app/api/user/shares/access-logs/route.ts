import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const url = new URL(request.url);
    const shareId = url.searchParams.get("shareId");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;

    // Build filter: only logs for shares owned by this user
    const where: Record<string, unknown> = {
      share: { ownerId: session.user.id },
    };

    if (shareId) {
      where.shareId = shareId;
    }

    const [logs, total] = await Promise.all([
      prisma.shareAccessLog.findMany({
        where,
        include: {
          share: {
            select: {
              slug: true,
              type: true,
            },
          },
        },
        orderBy: { accessedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.shareAccessLog.count({ where }),
    ]);

    // Batch load geolocation data for all unique IPs
    const uniqueIps = [...new Set(logs.map((l) => l.ip))];
    const geoData = await prisma.ipLocalisation.findMany({
      where: { ip: { in: uniqueIps } },
    });
    const geoMap = new Map(geoData.map((g) => [g.ip, g]));

    const enrichedLogs = logs.map((log) => ({
      id: log.id,
      shareId: log.shareId,
      slug: log.share.slug,
      shareType: log.share.type,
      ip: log.ip,
      userAgent: log.userAgent,
      accessedAt: log.accessedAt,
      geo: geoMap.get(log.ip) || null,
    }));

    return NextResponse.json({
      logs: enrichedLogs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching access logs:", error);
    return internalError(request);
  }
}
