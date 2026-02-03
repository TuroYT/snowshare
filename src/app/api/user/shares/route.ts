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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ shares });
  } catch (error) {
    console.error("Error fetching user shares:", error);
    return internalError(request);
  }
}
