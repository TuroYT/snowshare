import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { toUserShare, USER_SHARE_SELECT } from "@/lib/user-shares";

const MAX_LIMIT = 1000;

// GET - List the current user's shares (newest first)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    // Optional pagination (?limit=&offset=); without it every share is returned, as before
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit") || "", 10);
    const offsetParam = parseInt(searchParams.get("offset") || "", 10);
    const take =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : undefined;
    const skip = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : undefined;

    const shares = await prisma.share.findMany({
      where: {
        ownerId: session.user.id,
      },
      select: USER_SHARE_SELECT,
      orderBy: {
        createdAt: "desc",
      },
      take,
      skip,
    });

    return NextResponse.json({ shares: shares.map(toUserShare) });
  } catch (error) {
    console.error("Error fetching user shares:", error);
    return internalError(request);
  }
}
