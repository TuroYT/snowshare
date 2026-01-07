import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/oauth-providers
 * Get the list of enabled OAuth providers
 */
export async function GET() {
  try {
    const providers = await prisma.oAuthProvider.findMany({
      where: {
        enabled: true
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        enabled: true
      },
      orderBy: {
        displayName: "asc"
      }
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error fetching OAuth providers:", error);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}
