import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    // Get password from query params if provided
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;

    const result = await getFileShare(slug, password);

    if (result.errorCode) {
      return apiError(request, result.errorCode);
    }

    const { filePath: fullPath, originalFilename } = result;

    if (!fullPath || !existsSync(fullPath)) {
      return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Get file stats for size
    const stats = await stat(fullPath);
    const fileSize = stats.size;

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = getMimeType(ext);

    // Sanitize filename for Content-Disposition header to prevent header injection
    const safeFilename = sanitizeFilenameForHeader(originalFilename || "download");

    // Handle range request for resumable downloads
    const range = request.headers.get("range");

    if (range) {
      const rangeResult = parseRangeHeader(range, fileSize);

      if (!rangeResult) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const { start, end } = rangeResult;
      const chunksize = end - start + 1;
      const fileStream = createReadStream(fullPath, { start, end });
      const webStream = nodeStreamToWebStream(fileStream);

      const headers = new Headers();
      headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunksize.toString());
      headers.set("Content-Type", contentType);
      headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      return new NextResponse(webStream as ReadableStream<Uint8Array>, {
        status: 206,
        headers,
      });
    }

    // Full file download using streaming
    const fileStream = createReadStream(fullPath);
    const webStream = nodeStreamToWebStream(fileStream);

    // Set appropriate headers
    const headers = new Headers();
    headers.set("Content-Length", fileSize.toString());
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    // Allow inline viewing only for safe types (excludes SVG/HTML to prevent XSS)
    if (isSafeForInline(contentType)) {
      const disposition = request.headers.get("accept")?.includes("text/html")
        ? "inline"
        : "attachment";
      headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
    }

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
