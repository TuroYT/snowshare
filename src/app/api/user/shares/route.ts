import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

// GET - Récupérer tous les partages de l'utilisateur
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const shares = await prisma.share.findMany({
      where: {
        ownerId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        slug: true,
        filePath: true,
        paste: true,
        pastelanguage: true,
        urlOriginal: true,
        password: true,
        createdAt: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
        _count: {
          select: { accessLogs: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const sharesWithCount = shares.map(({ _count, ...share }) => ({
      ...share,
      accessCount: _count.accessLogs,
    }));

    return NextResponse.json({ shares: sharesWithCount });
  } catch (error) {
    console.error("Error fetching user shares:", error);
    return internalError(request);
  }
}
