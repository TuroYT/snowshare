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
    const shareId = url.searchParams.get("shareId") ?? undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = 50;
    const skip = (page - 1) * limit;

    const where = shareId
      ? { shareId, share: { ownerId: session.user.id } }
      : { share: { ownerId: session.user.id } };

    const [rawLogs, total] = await Promise.all([
      prisma.shareAccessLog.findMany({
        where,
        orderBy: { accessedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          ip: true,
          userAgent: true,
          accessedAt: true,
          share: {
            select: {
              slug: true,
              type: true,
            },
          },
        },
      }),
      prisma.shareAccessLog.count({ where }),
    ]);

    const uniqueIps = [
      ...new Set(rawLogs.map((l) => l.ip).filter((ip): ip is string => !!ip)),
    ];

    const geoData =
      uniqueIps.length > 0
        ? await prisma.ipLocalisation.findMany({ where: { ip: { in: uniqueIps } } })
        : [];

    const geoMap = new Map(geoData.map((g) => [g.ip, g]));

    const logs = rawLogs.map((log) => {
      const geo = log.ip ? geoMap.get(log.ip) : undefined;
      return {
        ...log,
        ipGeo: geo
          ? {
              countryCode: geo.countryCode,
              countryName: geo.countryName,
              city: geo.city,
              stateProv: geo.stateProv,
              status: geo.status,
            }
          : null,
      };
    });

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    console.error("Error fetching access logs:", error);
    return internalError(request);
  }
}
