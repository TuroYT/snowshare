import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/navigation/data
 * Combined endpoint for navigation data (replaces /api/setup/check + /api/user/profile)
 * Reduces API calls from 2 to 1 for better mobile performance
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Fetch settings (for allowSignin)
    const settings = await prisma.settings.findFirst();
    
    // If user is authenticated, fetch their profile
    let userData = null;
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
        },
      });
      userData = user;
    }

    return NextResponse.json({
      allowSignin: settings?.allowSignin ?? true,
      user: userData,
      isAuthenticated: !!session,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error("Error fetching navigation data:", error);
    return NextResponse.json(
      { error: "Failed to fetch navigation data" },
      { status: 500 }
    );
  }
}
