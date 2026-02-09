import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

/**
 * GET /api/user/accounts
 */
export async function GET(request: NextRequest) {
    try {
        const authOptions = await getAuthOptions();
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return apiError(request, ErrorCode.UNAUTHORIZED);
        }

        const accounts = await prisma.account.findMany({
            where: {
                userId: session.user.id
            },
            select: {
                id: true,
                provider: true,
                providerAccountId: true,
                type: true
            },
            orderBy: {
                provider: "asc"
            }
        });

        return NextResponse.json({ accounts });
    } catch (error) {
        console.error("Error fetching accounts:", error);
        return internalError(request);
    }
}

/**
 * DELETE /api/user/accounts
 */
export async function DELETE(request: NextRequest) {
    try {
        const authOptions = await getAuthOptions();
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return apiError(request, ErrorCode.UNAUTHORIZED);
        }

        const { accountId } = await request.json();

        if (!accountId) {
            return apiError(request, ErrorCode.MISSING_DATA);
        }

        const account = await prisma.account.findFirst({
            where: {
                id: accountId,
                userId: session.user.id
            }
        });

        if (!account) {
            return apiError(request, ErrorCode.ACCOUNT_NOT_FOUND);
        }

        // Verify if it's the only authentication method
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: true
            }
        });

        if (!user) {
            return apiError(request, ErrorCode.USER_NOT_FOUND);
        }

        if (!user.password && user.accounts.length <= 1) {
            return apiError(request, ErrorCode.CANNOT_UNLINK_LAST_ACCOUNT);
        }

        await prisma.account.delete({
            where: {
                id: accountId
            }
        });

        return NextResponse.json({ message: "Account unlinked successfully" });
    } catch (error) {
        console.error("Error unlinking account:", error);
        return internalError(request);
    }
}
