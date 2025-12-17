/** API route for creating shares */

import { NextRequest, NextResponse } from "next/server";
import { createLinkShare } from "./(linkShare)/linkshare";
import { createPasteShare } from "./(pasteShare)/pasteshareshare";
import { createFileShareFromStream } from "./(fileShare)/fileshare";
import { parseMultipartStream, cleanupTempFile, FileSizeLimitError, QuotaExceededError } from "@/lib/multipart-parser";

async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";

    // Handle file uploads (multipart/form-data) with streaming
    if (contentType.includes("multipart/form-data")) {
        let tempFilePath: string | undefined;
        
        try {
            // Parse multipart with streaming - file is written directly to disk
            // Size limits AND IP quotas are enforced DURING streaming to prevent disk filling attacks
            const { fields, file } = await parseMultipartStream(req);
            
            const type = fields.type;
            if (type !== "FILE") {
                // Clean up temp file if type is wrong
                if (file?.tempPath) {
                    cleanupTempFile(file.tempPath);
                }
                return NextResponse.json(
                    { error: "Invalid share type for file upload" },
                    { status: 400 }
                );
            }

            if (!file) {
                return NextResponse.json({ error: "File required" }, { status: 400 });
            }

            tempFilePath = file.tempPath;

            const result = await createFileShareFromStream(
                file,
                req,
                fields.expiresAt ? new Date(fields.expiresAt) : undefined,
                fields.slug || undefined,
                fields.password || undefined
            );

            if (result?.error) {
                // Clean up temp file on error
                if (tempFilePath) {
                    cleanupTempFile(tempFilePath);
                }
                return NextResponse.json({ error: result.error }, { status: 400 });
            }
            
            return NextResponse.json({ share: result }, { status: 201 });
        } catch (error) {
            // Clean up temp file on error
            if (tempFilePath) {
                cleanupTempFile(tempFilePath);
            }
            
            // Handle specific error types
            if (error instanceof FileSizeLimitError) {
                return NextResponse.json({ error: error.message }, { status: 413 });
            }
            
            if (error instanceof QuotaExceededError) {
                return NextResponse.json({ error: error.message }, { status: 429 });
            }
            
            if (error instanceof Error && error.message.includes("filename")) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            
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
