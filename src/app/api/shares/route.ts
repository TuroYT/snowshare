/** API route for creating shares */

import { NextRequest, NextResponse } from "next/server";
import { createLinkShare } from "./(linkShare)/linkshare";
import { createPasteShare } from "./(pasteShare)/pasteshareshare";
import { createFileShare } from "./(fileShare)/fileshare";

async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";

    // Handle file uploads (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
        try {
            const formData = await req.formData();
            const type = formData.get("type") as string;

            if (type !== "FILE") {
                return NextResponse.json(
                        { error: "Invalid share type for file upload" },
                        { status: 400 }
                    );
            }

            const file = formData.get("file") as File;
            const expiresAt = formData.get("expiresAt") as string;
            const slug = formData.get("slug") as string;
            const password = formData.get("password") as string;

            if (!file) {
                return NextResponse.json({ error: "File required" }, { status: 400 });
            }

            const result = await createFileShare(
                file,
                req,
                expiresAt ? new Date(expiresAt) : undefined,
                slug || undefined,
                password || undefined
            );

            if (result?.error) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }
            return NextResponse.json({ share: result }, { status: 201 });
        } catch (error) {
            console.error("File upload error:", error);
            return NextResponse.json({ error: "Erreur lors du traitement du fichier" }, { status: 500 });
        }
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
                    return NextResponse.json({ error: result.error }, { status: 400 });
                }
                return NextResponse.json({ share: result }, { status: 201 });
            }
            case "PASTE": {
                const { paste, pastelanguage, expiresAt, slug, password } = data;
                const result = await createPasteShare(paste, pastelanguage, req, expiresAt, slug, password);
                if (result?.error) {
                    return NextResponse.json({ error: result.error }, { status: 400 });
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
