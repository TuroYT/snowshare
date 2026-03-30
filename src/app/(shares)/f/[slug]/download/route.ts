import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { getMimeType, sanitizeFilenameForHeader } from "@/lib/mime-types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;

    const result = await getFileShare(slug, password);

    if (result.errorCode) {
      return apiError(request, result.errorCode);
    }

    if (result.share?.isBulk) {
      return NextResponse.json(
        {
          error: "This is a bulk share. Use /bulk-download endpoint instead.",
          isBulk: true,
        },
        { status: 400 }
      );
    }

    const { filePath: fullPath, originalFilename } = result;

    if (!fullPath || !existsSync(fullPath)) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    const stats = await stat(fullPath);
    const fileSize = stats.size;

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = getMimeType(ext);
    const safeFilename = sanitizeFilenameForHeader(originalFilename || "download");

    // Handle range request
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

    // Full file download
    const fileStream = createReadStream(fullPath);
    const webStream = nodeStreamToWebStream(fileStream);

    const headers = new Headers();
    headers.set("Content-Length", fileSize.toString());
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
