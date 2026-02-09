import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

/**
 * POST /api/user/accounts/validate-link
 * Validate the link token to finalize linking a new OAuth account
 */
export async function POST(request: NextRequest) {
    try {
        const authOptions = await getAuthOptions();
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return apiError(request, ErrorCode.UNAUTHORIZED);
        }

        const { token } = await request.json();

        if (!token) {
            return apiError(request, ErrorCode.TOKEN_REQUIRED);
        }

        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token }
        });

        if (!verificationToken) {
            return apiError(request, ErrorCode.TOKEN_INVALID_OR_EXPIRED);
        }

        // Expiry check
        if (verificationToken.expires < new Date()) {
            await prisma.verificationToken.delete({ where: { token } });
            return apiError(request, ErrorCode.TOKEN_EXPIRED);
        }

        // Extract token information
        const parts = verificationToken.identifier.split(":");
        if (
            parts[0] !== "account-link" ||
            !session.user.email ||
            parts[1] !== session.user.email
        ) {
            return apiError(request, ErrorCode.TOKEN_INVALID);
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
            return apiError(request, ErrorCode.ACCOUNT_LINKING_FAILED);
        }

        await prisma.verificationToken.delete({ where: { token } });

        return NextResponse.json({ 
            message: "Account linked successfully",
            provider
        });
    } catch (error) {
        console.error("Error validating link token:", error);
        return internalError(request);
    }
}
