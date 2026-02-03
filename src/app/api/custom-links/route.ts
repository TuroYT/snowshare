import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

// GET – Retrieve all links
export async function GET(request: NextRequest) {
    try {
        const links = await prisma.customLink.findMany({
            orderBy: { createdAt: "asc" }
        });
        return NextResponse.json({ links }, { status: 200 });
    } catch (error) {
        console.error("Error fetching custom links:", error);
        return internalError(request);
    }
}

// POST - Add a new link
export async function POST(request: NextRequest) {
    try {
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

        const body = await request.json();
        const { name, url } = body;

        // Validation
        if (!name || !url) {
            return apiError(request, ErrorCode.MISSING_DATA);
        }

        if (typeof name !== "string" || !name.trim()) {
            return apiError(request, ErrorCode.LINK_NAME_REQUIRED);
        }

        if (typeof url !== "string" || !url.trim()) {
            return apiError(request, ErrorCode.LINK_URL_REQUIRED);
        }

        // URL Validation
        try {
            new URL(url.trim());
        } catch {
            return apiError(request, ErrorCode.LINK_URL_INVALID);
        }

        const link = await prisma.customLink.create({
            data: {
                name: name.trim(),
                url: url.trim()
            }
        });

        return NextResponse.json({ link }, { status: 201 });
    } catch (error) {
        console.error("Error creating custom link:", error);
        return internalError(request);
    }
}
