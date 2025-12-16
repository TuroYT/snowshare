import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const USER_COUNT = await prisma.user.count();
        const NEED_SETUP = USER_COUNT === 0;

        // Get settings from database
        let allowSignup = true; // Default value
        let settings = await prisma.settings.findFirst({
            select: {
                id: true,
                allowSignin: true,
                appName: true,
                appDescription: true,
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
                borderColor: true
            }
        });

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
                        appDescription: settings.appDescription ?? "Share your files, pastes, and URLs securely",
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
                        borderColor: settings.borderColor ?? "#374151"
                    }
                });
                console.log("✅ Settings NULL values fixed with defaults");
            }
        } else if (NEED_SETUP) {
            // Create default settings if they don't exist during setup
            await prisma.settings.upsert({
                where: { id: 1 },
                update: {},
                create: {
                    id: 1,
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
                    borderColor: "#374151"
                }
            });
        }

        return NextResponse.json({
            needsSetup: NEED_SETUP,
            allowSignup
        });
    } catch (error) {
        console.error("Error checking setup status:", error);
        return NextResponse.json({ error: "Failed to check setup status" }, { status: 500 });
    }
}
