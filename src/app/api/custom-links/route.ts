import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET – Retrieve all links
export async function GET() {
    try {
        const links = await prisma.customLink.findMany({
            orderBy: { createdAt: "asc" }
        });
        return NextResponse.json({ links }, { status: 200 });
    } catch (error) {
        console.error("Error fetching custom links:", error);
        return NextResponse.json({ error: "Failed to fetch custom links" }, { status: 500 });
    }
}

// POST - Add a new link
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // Checking admin permissions
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        });

        if (!user?.isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { name, url } = body;

        // Validation
        if (!name || !url) {
            return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
        }

        if (typeof name !== "string" || !name.trim()) {
            return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 });
        }

        if (typeof url !== "string" || !url.trim()) {
            return NextResponse.json({ error: "URL must be a non-empty string" }, { status: 400 });
        }

        // URL Validation
        try {
            new URL(url.trim());
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
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
        return NextResponse.json({ error: "Failed to create custom link" }, { status: 500 });
    }
}
