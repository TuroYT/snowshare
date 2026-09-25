import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings, getSettingsCached, invalidateSettingsCache } from "@/lib/settings";
import { internalError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const USER_COUNT = await prisma.user.count();
    const NEED_SETUP = USER_COUNT === 0;

    // Get settings from database
    let allowSignup = true; // Default value
    const settings = await getSettingsCached();

    if (settings) {
      allowSignup = settings.allowSignin;

      // Fix NULL values if they exist
      const needsUpdate =
        !settings.appName ||
        !settings.appDescription ||
        !settings.primaryColor ||
        !settings.primaryHover ||
        !settings.primaryDark ||
        !settings.secondaryColor ||
        !settings.secondaryHover ||
        !settings.secondaryDark ||
        !settings.backgroundColor ||
        !settings.surfaceColor ||
        !settings.textColor ||
        !settings.textMuted ||
        !settings.borderColor;

      if (needsUpdate) {
        await prisma.settings.update({
          where: { id: settings.id },
          data: {
            appName: settings.appName ?? "SnowShare",
            appDescription:
              settings.appDescription ?? "Share your files, pastes, and URLs securely",
            primaryColor: settings.primaryColor ?? "#3B82F6",
            primaryHover: settings.primaryHover ?? "#2563EB",
            primaryDark: settings.primaryDark ?? "#1E40AF",
            secondaryColor: settings.secondaryColor ?? "#8B5CF6",
            secondaryHover: settings.secondaryHover ?? "#7C3AED",
            secondaryDark: settings.secondaryDark ?? "#6D28D9",
            backgroundColor: settings.backgroundColor ?? "#111827",
            surfaceColor: settings.surfaceColor ?? "#1F2937",
            textColor: settings.textColor ?? "#F9FAFB",
            textMuted: settings.textMuted ?? "#D1D5DB",
            borderColor: settings.borderColor ?? "#374151",
          },
        });
        invalidateSettingsCache();
        console.log("✅ Settings NULL values fixed with defaults");
      }
    } else if (NEED_SETUP) {
      // Create default settings if they don't exist during setup
      // Every column has a database default
      await getOrCreateSettings();
    }

    return NextResponse.json({
      needsSetup: NEED_SETUP,
      allowSignup,
      disableCredentialsLogin: settings?.disableCredentialsLogin ?? false,
      onlySSOMode: settings ? settings.disableCredentialsLogin : false,
      captchaEnabled: settings?.captchaEnabled ?? false,
      captchaProvider: settings?.captchaProvider ?? null,
      captchaSiteKey: settings?.captchaSiteKey ?? null,
      emailVerificationRequired:
        (settings?.emailVerificationRequired ?? false) && (settings?.smtpEnabled ?? false),
      allowIframeEmbedding: settings?.allowIframeEmbedding ?? false,
    });
  } catch (error) {
    console.error("Error checking setup status:", error);
    return internalError(request);
  }
}
