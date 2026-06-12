import { NextRequest, NextResponse } from "next/server";
import { getStorageReadStream, getStorageFileSize } from "@/lib/storage";
import { nodeStreamToWebStream, parseRangeHeader } from "@/lib/stream-utils";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";
import { validateDownloadToken } from "@/lib/download-token";
import { prisma } from "@/lib/prisma";
import path from "path";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || undefined;

    const share = await prisma.share.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        filePath: true,
        password: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
      },
    });

    if (!share || share.type !== "FILE") {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.maxViews !== null && share.viewCount >= share.maxViews) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.password) {
      if (!token || !validateDownloadToken(token, share.id)) {
        return apiError(request, ErrorCode.DOWNLOAD_TOKEN_INVALID);
      }
    }

    if (!share.filePath) {
      return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
    }

    const fileSize = await getStorageFileSize(share.filePath);
    const ext = path.extname(share.filePath).toLowerCase();
    const contentType = getMimeType(ext);
    const originalFilename = share.filePath.split("_").slice(1).join("_");
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
      const fileStream = await getStorageReadStream(share.filePath, { start, end });
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

      return new NextResponse(webStream as ReadableStream<Uint8Array>, { status: 206, headers });
    }

    const fileStream = await getStorageReadStream(share.filePath);
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

    return new NextResponse(webStream as ReadableStream<Uint8Array>, { status: 200, headers });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
