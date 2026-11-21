import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const providers = await prisma.oAuthProvider.findMany({
      where: {
        enabled: true,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        enabled: true,
      },
      orderBy: {
        displayName: "asc",
      },
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error fetching OAuth providers:", error);
    return apiError(request, ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
