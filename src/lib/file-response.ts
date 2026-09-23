import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getStorageReadStream, getStorageFileSize } from "@/lib/storage";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";

export interface StreamStoredFileOptions {
  /** Storage key (local filename or S3 key) */
  key: string;
  /** Filename presented to the client */
  filename: string;
  /** Explicit content type; derived from the storage key extension when omitted */
  contentType?: string | null;
  /** Known size in bytes; fetched from storage when omitted */
  size?: number;
  /**
   * How to pick Content-Disposition for full (non-range) responses:
   * - "attachment": always download
   * - "inline-when-safe": inline for safe types (images, PDF, video)
   * - "inline-when-browsing": inline for safe types only when the client accepts text/html
   */
  disposition?: "attachment" | "inline-when-safe" | "inline-when-browsing";
}

const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Stream a stored file to the client with HTTP Range support.
 * Shared by every file download/preview route.
 */
export async function streamStoredFile(
  request: NextRequest,
  { key, filename, contentType, size, disposition = "attachment" }: StreamStoredFileOptions
): Promise<Response> {
  const fileSize = size ?? (await getStorageFileSize(key));
  const type = contentType || getMimeType(path.extname(key).toLowerCase());
  const safeFilename = sanitizeFilenameForHeader(filename || "download");

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
    const fileStream = await getStorageReadStream(key, { start, end });
    const headers = new Headers(NO_CACHE_HEADERS);
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Type", type);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);

    return new NextResponse(nodeStreamToWebStream(fileStream) as ReadableStream<Uint8Array>, {
      status: 206,
      headers,
    });
  }

  let inline = false;
  if (disposition !== "attachment" && isSafeForInline(type)) {
    inline =
      disposition === "inline-when-safe" || !!request.headers.get("accept")?.includes("text/html");
  }

  const fileStream = await getStorageReadStream(key);
  const headers = new Headers(NO_CACHE_HEADERS);
  headers.set("Content-Length", String(fileSize));
  headers.set("Content-Type", type);
  headers.set("Accept-Ranges", "bytes");
  headers.set(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${safeFilename}"`
  );

  return new NextResponse(nodeStreamToWebStream(fileStream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers,
  });
}

/**
 * Whether a request should count as a new download (not a resumed/seeking range request).
 */
export function isInitialDownloadRequest(request: NextRequest): boolean {
  const range = request.headers.get("range");
  return !range || /^bytes=0-/.test(range.trim());
}
