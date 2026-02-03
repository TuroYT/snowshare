/** API route for creating shares (Link and Paste only)
 * File uploads are handled by /pages/api/upload.ts for true streaming */

import { NextRequest, NextResponse } from "next/server";
import { createLinkShare } from "./(linkShare)/linkshare";
import { createPasteShare } from "./(pasteShare)/pasteshareshare";

async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";

    // File uploads should use /api/upload (Pages Router) for true streaming
    if (contentType.includes("multipart/form-data")) {
        return NextResponse.json(
            { error: "File uploads should use /api/upload endpoint" },
            { status: 400 }
        );
    }

    // Handle JSON data for other share types
    try {
        const data = await req.json();
        if (!data || !data.type) {
            return NextResponse.json({ error: "Share type required" }, { status: 400 });
        }

        switch (data.type) {
            case "URL": {
                const { urlOriginal, expiresAt, slug, password } = data;
                const result = await createLinkShare(urlOriginal, req, expiresAt, slug, password);
                if (result?.error) {
                    const statusCode = result.status || 400;
                    return NextResponse.json({ error: result.error }, { status: statusCode });
                }
                return NextResponse.json({ share: result }, { status: 201 });
            }
            case "PASTE": {
                const { paste, pastelanguage, expiresAt, slug, password } = data;
                // Convert expiresAt string to Date if provided
                const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
                const result = await createPasteShare(paste, pastelanguage, req, expiresAtDate, slug, password);
                if (result?.error) {
                    const statusCode = result.status || 400;
                    return NextResponse.json({ error: result.error }, { status: statusCode });
                }
                return NextResponse.json({ share: result }, { status: 201 });
            }
            default:
                return NextResponse.json({ error: "Invalid share type" }, { status: 400 });
        }
    } catch (err) {
        console.error("JSON parsing error:", err);
        return NextResponse.json({ error: "Invalid JSON data" }, { status: 400 });
    }
}

export { POST };
