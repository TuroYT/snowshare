import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/user/accounts
 */
export async function GET(_request: NextRequest) {
    try {
        const authOptions = await getAuthOptions();
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { accountId } = await request.json();

        if (!accountId) {
            return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
        }

        const account = await prisma.account.findFirst({
            where: {
                id: accountId,
                userId: session.user.id
            }
        });

        if (!account) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        // Verify if it's the only authentication method
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!user.password && user.accounts.length <= 1) {
            return NextResponse.json(
                { error: "Cannot remove the only authentication method. Please set a password first." },
                { status: 400 }
            );
        }

        await prisma.account.delete({
            where: {
                id: accountId
            }
        });

        return NextResponse.json({ message: "Account unlinked successfully" });
    } catch (error) {
        console.error("Error unlinking account:", error);
        return NextResponse.json({ error: "Failed to unlink account" }, { status: 500 });
    }
}
