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
          appName: "SnowShare",
          appDescription: "Share your files, pastes, and URLs securely",
          primaryColor: "#3B82F6",
          primaryHover: "#2563EB",
          primaryDark: "#1E40AF",
          secondaryColor: "#8B5CF6",
          secondaryHover: "#7C3AED",
          secondaryDark: "#6D28D9",
          backgroundColor: "#111827",
          surfaceColor: "#1F2937",
          textColor: "#F9FAFB",
          textMuted: "#D1D5DB",
          borderColor: "#374151",
        },
      });
    }

    // Return public settings including theme colors
    return NextResponse.json({
      settings: {
        allowSignin: settings.allowSignin,
        allowAnonFileShare: settings.allowAnonFileShare,
        anoMaxUpload: settings.anoMaxUpload,
        authMaxUpload: settings.authMaxUpload,
        anoIpQuota: settings.anoIpQuota,
        authIpQuota: settings.authIpQuota,
        useGiBForAnon: settings.useGiBForAnon,
        useGiBForAuth: settings.useGiBForAuth,
        appName: settings.appName,
        appDescription: settings.appDescription,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        primaryColor: settings.primaryColor,
        primaryHover: settings.primaryHover,
        primaryDark: settings.primaryDark,
        secondaryColor: settings.secondaryColor,
        secondaryHover: settings.secondaryHover,
        secondaryDark: settings.secondaryDark,
        backgroundColor: settings.backgroundColor,
        surfaceColor: settings.surfaceColor,
        textColor: settings.textColor,
        textMuted: settings.textMuted,
        borderColor: settings.borderColor,
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
