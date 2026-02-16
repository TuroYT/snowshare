import { prisma } from "@/lib/prisma";

const DEFAULTS = {
    appName: "SnowShare",
    appDescription: "Partagez vos fichiers, pastes et URLs en toute sécurité",
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
    fontFamily: "Geist"
};

const defaultSettings = {
    settings: {
        allowSignin: true,
        allowAnonFileShare: true,
        anoMaxUpload: 2048,
        authMaxUpload: 51200,
        anoIpQuota: 4096,
        authIpQuota: 102400,
        appName: DEFAULTS.appName,
        appDescription: DEFAULTS.appDescription,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: DEFAULTS.primaryColor,
        primaryHover: DEFAULTS.primaryHover,
        primaryDark: DEFAULTS.primaryDark,
        secondaryColor: DEFAULTS.secondaryColor,
        secondaryHover: DEFAULTS.secondaryHover,
        secondaryDark: DEFAULTS.secondaryDark,
        backgroundColor: DEFAULTS.backgroundColor,
        surfaceColor: DEFAULTS.surfaceColor,
        textColor: DEFAULTS.textColor,
        textMuted: DEFAULTS.textMuted,
        borderColor: DEFAULTS.borderColor,
        fontFamily: DEFAULTS.fontFamily
    }
};

const defaultBranding = {
    branding: {
        appName: DEFAULTS.appName,
        appDescription: DEFAULTS.appDescription,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: DEFAULTS.primaryColor,
        primaryHover: DEFAULTS.primaryHover,
        primaryDark: DEFAULTS.primaryDark,
        secondaryColor: DEFAULTS.secondaryColor,
        secondaryHover: DEFAULTS.secondaryHover,
        secondaryDark: DEFAULTS.secondaryDark,
        backgroundColor: DEFAULTS.backgroundColor,
        surfaceColor: DEFAULTS.surfaceColor,
        textColor: DEFAULTS.textColor,
        textMuted: DEFAULTS.textMuted,
        borderColor: DEFAULTS.borderColor,
        fontFamily: DEFAULTS.fontFamily
    }
};

export async function getPublicSettings() {
    // If DATABASE_URL is not set (e.g. during static build/prerender),
    // avoid calling Prisma and return safe defaults.
    if (!process.env.DATABASE_URL) {
        return defaultSettings;
    }

    try {
        let s = await prisma.settings.findFirst();
        if (!s) {
            s = await prisma.settings.create({
                data: {
                    allowSignin: true,
                    allowAnonFileShare: true,
                    anoMaxUpload: 2048,
                    authMaxUpload: 51200,
                    anoIpQuota: 4096,
                    authIpQuota: 102400,
                    ...DEFAULTS
                }
            });
        }

        return {
            settings: {
                allowSignin: s.allowSignin,
                allowAnonFileShare: s.allowAnonFileShare,
                anoMaxUpload: s.anoMaxUpload,
                authMaxUpload: s.authMaxUpload,
                appName: s.appName,
                appDescription: s.appDescription,
                logoUrl: s.logoUrl,
                faviconUrl: s.faviconUrl,
                primaryColor: s.primaryColor,
                primaryHover: s.primaryHover,
                primaryDark: s.primaryDark,
                secondaryColor: s.secondaryColor,
                secondaryHover: s.secondaryHover,
                secondaryDark: s.secondaryDark,
                backgroundColor: s.backgroundColor,
                surfaceColor: s.surfaceColor,
                textColor: s.textColor,
                textMuted: s.textMuted,
                borderColor: s.borderColor,
                fontFamily: s.fontFamily
            }
        } as const;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        console.warn(
            "failed to fetch settings from database, note that this is expected during static builds/prerendering:"
        );
        return defaultSettings;
    }
}

export async function getBrandingSettings() {
    // If DATABASE_URL is not set, return default branding to avoid Prisma calls
    if (!process.env.DATABASE_URL) {
        return defaultBranding;
    }
    try {
        const s = await prisma.settings.findFirst({
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
                surfaceColor: true,
                textColor: true,
                textMuted: true,
                borderColor: true,
                fontFamily: true
            }
        });

        return {
            branding: s ?? {
                ...DEFAULTS,
                appName: DEFAULTS.appName,
                appDescription: DEFAULTS.appDescription,
                logoUrl: null,
                faviconUrl: null
            }
        } as const;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        console.warn(
            "failed to fetch settings from database, note that this is expected during static builds/prerendering:"
        );

        return defaultBranding;
    }
}
