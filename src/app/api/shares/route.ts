/** API route for creating shares (Link and Paste only)
 * File uploads are handled by /pages/api/upload.ts for true streaming */

import { NextRequest, NextResponse } from "next/server";
import { createLinkShare } from "./(linkShare)/linkshare";
import { createPasteShare } from "./(pasteShare)/pasteshareshare";
import { apiError, ErrorCode } from "@/lib/api-errors";

async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";

    // File uploads should use /api/upload (Pages Router) for true streaming
    if (contentType.includes("multipart/form-data")) {
        return apiError(req, ErrorCode.INVALID_REQUEST);
    }

    // Handle JSON data for other share types
    try {
        const data = await req.json();
        if (!data || !data.type) {
            return apiError(req, ErrorCode.SHARE_TYPE_REQUIRED);
        }

        switch (data.type) {
            case "URL": {
                const { urlOriginal, expiresAt, slug, password, maxViews } = data;
                const result = await createLinkShare(urlOriginal, req, expiresAt, slug, password, maxViews);
                if (result?.errorCode) {
                    return apiError(req, result.errorCode, result.params);
                }
                return NextResponse.json({ share: result }, { status: 201 });
            }
            case "PASTE": {
                const { paste, pastelanguage, expiresAt, slug, password, maxViews } = data;
                // Convert expiresAt string to Date if provided
                const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
                const result = await createPasteShare(paste, pastelanguage, req, expiresAtDate, slug, password, maxViews);
                if (result?.errorCode) {
                    return apiError(req, result.errorCode, result.params);
                }
                return NextResponse.json({ share: result }, { status: 201 });
            }
            default:
                return apiError(req, ErrorCode.SHARE_TYPE_INVALID);
        }
    } catch (err) {
        console.error("JSON parsing error:", err);
        return apiError(req, ErrorCode.INVALID_JSON);
    }
}

export { POST };
