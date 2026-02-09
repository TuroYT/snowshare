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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return apiError(request, ErrorCode.ADMIN_ONLY);
    }

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type") || "all";
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: {
      type?: "FILE" | "PASTE" | "URL";
      OR?: Array<{ slug: { contains: string; mode: "insensitive" } } | { owner: { email: { contains: string; mode: "insensitive" } } } | { ipSource: { contains: string } }>;
    } = {};
    
    if (type !== "all") {
      where.type = type as "FILE" | "PASTE" | "URL";
    }

    if (search) {
      where.OR = [
        { slug: { contains: search, mode: "insensitive" } },
        { owner: { email: { contains: search, mode: "insensitive" } } },
        { ipSource: { contains: search } }
      ];
    }

    // Get shares with pagination
    const [shares, total] = await Promise.all([
      prisma.share.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.share.count({ where })
    ]);

    // Batch fetch geolocation data for all IPs on this page
    const uniqueIps = [...new Set(
      shares.map(s => s.ipSource).filter((ip): ip is string => !!ip)
    )];

    const geoData = uniqueIps.length > 0
      ? await prisma.ipLocalisation.findMany({
          where: { ip: { in: uniqueIps } },
        })
      : [];

    const geoMap = new Map(geoData.map(g => [g.ip, g]));

    // Format shares for response
    const logs = shares.map(share => {
      const geo = share.ipSource ? geoMap.get(share.ipSource) : undefined;
      return {
        id: share.id,
        type: share.type,
        slug: share.slug,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() || null,
        ipSource: share.ipSource,
        hasPassword: !!share.password,
        maxViews: share.maxViews,
        viewCount: share.viewCount,
        owner: share.owner ? {
          id: share.owner.id,
          email: share.owner.email,
          name: share.owner.name
        } : null,
        ipGeo: geo ? {
          countryCode: geo.countryCode,
          countryName: geo.countryName,
          continentCode: geo.continentCode,
          continentName: geo.continentName,
          stateProv: geo.stateProv,
          city: geo.city,
          status: geo.status,
        } : null,
      };
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching logs:", error);
    return internalError(request);
  }
}
