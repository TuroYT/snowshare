import { getSettingsCached } from "@/lib/settings";
import { NextResponse } from "next/server";

const DEFAULT_BRANDING = {
  appName: "SnowShare",
  appDescription: "Share your files, pastes, and URLs securely",
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
};

type Branding = { [K in keyof typeof DEFAULT_BRANDING]: string | null };

// Public endpoint to get branding settings (no auth required).
// Only the branding fields are returned: the Settings row also holds secrets (SMTP, S3, captcha).
export async function GET() {
  try {
    const settings = await getSettingsCached();

    if (!settings) {
      return NextResponse.json({ branding: DEFAULT_BRANDING });
    }

    const branding = Object.fromEntries(
      (Object.keys(DEFAULT_BRANDING) as (keyof Branding)[]).map((key) => [key, settings[key]])
    ) as Branding;

    return NextResponse.json({ branding });
  } catch (error) {
    console.error("Error fetching branding settings:", error);
    return NextResponse.json({ branding: DEFAULT_BRANDING }, { status: 200 });
  }
}
