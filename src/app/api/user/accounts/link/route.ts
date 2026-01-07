import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/**
 * POST /api/user/accounts/link
 */
export async function POST(request: NextRequest) {
    try {
        const authOptions = await getAuthOptions();
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { provider } = await request.json();

        if (!provider) {
            return NextResponse.json({ error: "Provider is required" }, { status: 400 });
        }

        // Verify that the provider exists and is enabled
        const oauthProvider = await prisma.oAuthProvider.findFirst({
            where: {
                name: provider,
                enabled: true
            }
        });

        if (!oauthProvider) {
            return NextResponse.json({ error: "Provider not found or disabled" }, { status: 404 });
        }

        // Verify if the account is not already linked
        const existingAccount = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
                provider: provider
            }
        });

        if (existingAccount) {
            return NextResponse.json({ error: "Account already linked" }, { status: 400 });
        }

        const linkToken = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store the token with the EMAIL and provider in VerificationToken
        // Format: account-link:{email}:{provider}
        // We use the email because multiple users can have the same email (before linking)
        const identifier = `account-link:${session.user.email}:${provider}`;
    
        
        await prisma.verificationToken.create({
            data: {
                identifier,
                token: linkToken,
                expires: expiresAt
            }
        });

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const linkUrl = `${baseUrl}/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(`/profile?tab=accounts&linked=true`)}`;

        const response = NextResponse.json({
            linkUrl,
            provider,
            expiresAt: expiresAt.toISOString()
        });

        // Set the httpOnly cookie with the token
        response.cookies.set("__snowshare-link-token", linkToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600 // 10 minutes
        });

        return response;
    } catch (error) {
        console.error("Error generating link:", error);
        return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
    }
}
