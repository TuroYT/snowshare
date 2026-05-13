import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { getStorageReadStream, getStorageFileSize } from "@/lib/storage";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";
import path from "path";

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

    const { storageKey, originalFilename } = result;

    if (!storageKey) {
      return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
    }

    const fileSize = await getStorageFileSize(storageKey);
    const ext = path.extname(storageKey).toLowerCase();
    const contentType = getMimeType(ext);
    const safeFilename = sanitizeFilenameForHeader(originalFilename || "download");

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
      const fileStream = await getStorageReadStream(storageKey, { start, end });
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

    const fileStream = await getStorageReadStream(storageKey);
    const webStream = nodeStreamToWebStream(fileStream);

    const headers = new Headers();
    headers.set("Content-Length", fileSize.toString());
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    if (isSafeForInline(contentType)) {
      const disposition = request.headers.get("accept")?.includes("text/html")
        ? "inline"
        : "attachment";
      headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
    } else {
      headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
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
