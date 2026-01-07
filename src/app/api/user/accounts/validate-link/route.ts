import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user/accounts/validate-link
 * Validate the link token to finalize linking a new OAuth account
 */
export async function POST(request: NextRequest) {
    try {
        const authOptions = await getAuthOptions();
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token }
        });

        if (!verificationToken) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        // Expiry check
        if (verificationToken.expires < new Date()) {
            await prisma.verificationToken.delete({ where: { token } });
            return NextResponse.json({ error: "Token expired" }, { status: 400 });
        }

        // Extract token information
        const parts = verificationToken.identifier.split(":");
        if (
            parts[0] !== "account-link" ||
            !session.user.email ||
            parts[1] !== session.user.email
        ) {
            return NextResponse.json({ error: "Invalid token" }, { status: 400 });
        }

        const provider = parts[2];

        // Verify that the account is now linked
        const linkedAccount = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
                provider: provider
            }
        });

        if (!linkedAccount) {
            await prisma.verificationToken.delete({ where: { token } });
            return NextResponse.json({ error: "Account linking failed" }, { status: 400 });
        }

        await prisma.verificationToken.delete({ where: { token } });

        return NextResponse.json({ 
            message: "Account linked successfully",
            provider
        });
    } catch (error) {
        console.error("Error validating link token:", error);
        return NextResponse.json({ error: "Failed to validate token" }, { status: 500 });
    }
}
