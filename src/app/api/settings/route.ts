import { getOrCreateSettings } from "@/lib/settings";
import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCode } from "@/lib/api-errors";

// Public endpoint to get public settings (no authentication required)
export async function GET(request: NextRequest) {
  try {
    const settings = await getOrCreateSettings();

    // Return public settings including theme colors
    return NextResponse.json(
      {
        settings: {
          allowSignin: settings.allowSignin,
          allowAnonFileShare: settings.allowAnonFileShare,
          allowAnonLinkShare: settings.allowAnonLinkShare,
          allowAnonPasteShare: settings.allowAnonPasteShare,
          anoMaxUpload: settings.anoMaxUpload,
          authMaxUpload: settings.authMaxUpload,
          anoIpQuota: settings.anoIpQuota,
          authIpQuota: settings.authIpQuota,
          defaultExpirationDays: settings.defaultExpirationDays,
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
          backgroundImageUrl: settings.backgroundImageUrl,
          surfaceColor: settings.surfaceColor,
          textColor: settings.textColor,
          textMuted: settings.textMuted,
          borderColor: settings.borderColor,
          fontFamily: settings.fontFamily,
          emailEnabled: !!(settings.smtpEnabled && settings.smtpHost),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching public settings:", error);
    return apiError(request, ErrorCode.INTERNAL_SERVER_ERROR);
  }
}
