import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Public endpoint to get public settings (no authentication required)
export async function GET() {
  try {
    let settings = await prisma.settings.findFirst();
    
    // Create default settings if not exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          allowSignin: true,
          allowAnonFileShare: true,
          anoMaxUpload: 2048,
          authMaxUpload: 51200,
          anoIpQuota: 4096,
          authIpQuota: 102400,
        },
      });
    }

    // Return only public settings (no sensitive data)
    return NextResponse.json({
      settings: {
        allowSignin: settings.allowSignin,
        allowAnonFileShare: settings.allowAnonFileShare,
        anoMaxUpload: settings.anoMaxUpload,
        authMaxUpload: settings.authMaxUpload,
      },
    });
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
