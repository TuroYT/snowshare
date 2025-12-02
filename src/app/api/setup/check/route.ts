import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const USER_COUNT = await prisma.user.count();
        const NEED_SETUP = USER_COUNT === 0;

        // Get settings from database
        let allowSignup = true; // Default value
        const settings = await prisma.settings.findFirst({
            select: {
                allowSignin: true
            }
        });

        if (settings) {
            allowSignup = settings.allowSignin;
        } else if (NEED_SETUP) {
            // Create default settings if they don't exist during setup
            await prisma.settings.upsert({
                where: { id: 1 },
                update: {},
                create: {
                    id: 1,
                    allowSignin: true
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
