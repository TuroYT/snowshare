import { NextRequest, NextResponse } from "next/server";
import { getStorageReadStream, getStorageFileSize } from "@/lib/storage";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";
import path from "path";

const NO_CACHE_HEADERS = [
  ["Cache-Control", "no-cache, no-store, must-revalidate"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
] as const;

function applyNoCacheHeaders(headers: Headers): void {
  for (const [key, value] of NO_CACHE_HEADERS) {
    headers.set(key, value);
  }
}

export async function serveFileResponse(
  request: NextRequest,
  filePath: string,
  filename: string,
  { allowInline = false }: { allowInline?: boolean } = {}
): Promise<NextResponse> {
  const fileSize = await getStorageFileSize(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = getMimeType(ext);
  const safeFilename = sanitizeFilenameForHeader(filename || "download");

  const range = request.headers.get("range");

  if (range) {
    const rangeResult = parseRangeHeader(range, fileSize);

    if (!rangeResult) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const { start, end } = rangeResult;
    const fileStream = await getStorageReadStream(filePath, { start, end });
    const webStream = nodeStreamToWebStream(fileStream);

    const headers = new Headers();
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", (end - start + 1).toString());
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
    applyNoCacheHeaders(headers);

    return new NextResponse(webStream as ReadableStream<Uint8Array>, { status: 206, headers });
  }

  const fileStream = await getStorageReadStream(filePath);
  const webStream = nodeStreamToWebStream(fileStream);

  let disposition = "attachment";
  if (allowInline && isSafeForInline(contentType)) {
    disposition = request.headers.get("accept")?.includes("text/html") ? "inline" : "attachment";
  }

  const headers = new Headers();
  headers.set("Content-Length", fileSize.toString());
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
  applyNoCacheHeaders(headers);

  return new NextResponse(webStream as ReadableStream<Uint8Array>, { status: 200, headers });
}
