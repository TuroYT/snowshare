import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

// DELETE – Remove the link
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        // Checking admin permissions
        if (!session?.user?.id) {
            return apiError(request, ErrorCode.UNAUTHORIZED);
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        });

        if (!user?.isAdmin) {
            return apiError(request, ErrorCode.ADMIN_ONLY);
        }

        if (!id) {
            return apiError(request, ErrorCode.MISSING_DATA);
        }

        // Checking if the link exists
        const link = await prisma.customLink.findUnique({
            where: { id }
        });

        if (!link) {
            return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
        }

        await prisma.customLink.delete({
            where: { id }
        });

        return NextResponse.json({ message: "Link deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error("Error deleting custom link:", error);
        return internalError(request);
    }
}
