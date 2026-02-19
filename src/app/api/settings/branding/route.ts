import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Public endpoint to get branding settings (no auth required)
export async function GET() {
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        appName: true,
        appDescription: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        primaryHover: true,
        primaryDark: true,
        secondaryColor: true,
        secondaryHover: true,
        secondaryDark: true,
        backgroundColor: true,
        backgroundImageUrl: true,
        surfaceColor: true,
        textColor: true,
        textMuted: true,
        borderColor: true,
        fontFamily: true,
      },
    });

    // Return default values if no settings exist
    if (!settings) {
      return NextResponse.json({
        branding: {
          appName: "SnowShare",
          appDescription: "Share your files, pastes and URLs securely",
          logoUrl: null,
          faviconUrl: null,
          primaryColor: "#3B82F6",
          primaryHover: "#2563EB",
          primaryDark: "#1E40AF",
          secondaryColor: "#8B5CF6",
          secondaryHover: "#7C3AED",
          secondaryDark: "#6D28D9",
          backgroundColor: "#111827",
          backgroundImageUrl: null,
          surfaceColor: "#1F2937",
          textColor: "#F9FAFB",
          textMuted: "#D1D5DB",
          borderColor: "#374151",
          fontFamily: "Geist",
        },
      });
    }

    return NextResponse.json({ branding: settings });
  } catch (error) {
    console.error("Error fetching branding settings:", error);
    return NextResponse.json(
      {
        branding: {
          appName: "SnowShare",
          appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
          logoUrl: null,
          faviconUrl: null,
          primaryColor: "#3B82F6",
          primaryHover: "#2563EB",
          primaryDark: "#1E40AF",
          secondaryColor: "#8B5CF6",
          secondaryHover: "#7C3AED",
          secondaryDark: "#6D28D9",
          backgroundColor: "#111827",
          backgroundImageUrl: null,
          surfaceColor: "#1F2937",
          textColor: "#F9FAFB",
          textMuted: "#D1D5DB",
          borderColor: "#374151",
          fontFamily: "Geist",
        },
      },
      { status: 200 }
    );
  }
}
