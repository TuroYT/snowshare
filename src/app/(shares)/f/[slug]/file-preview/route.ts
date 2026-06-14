import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateDownloadToken } from "@/lib/download-token";
import path from "path";
import { getStorageReadStream, getStorageFileSize, storageFileExists } from "@/lib/storage";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { nodeStreamToWebStream } from "@/lib/stream-utils";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";

type ShareAccess = {
  id: string;
  type: string;
  password: string | null;
  expiresAt: Date | null;
  isBulk: boolean;
  maxViews: number | null;
  viewCount: number;
} | null;

async function validateShareAccess(
  request: NextRequest,
  share: ShareAccess,
  token: string | undefined
): Promise<NextResponse | null> {
  if (!share || share.type !== "FILE" || !share.isBulk) {
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
  return null;
}

async function buildFileResponse(
  shareFile: { filePath: string; originalName: string | null; mimeType: string | null },
  fileSize: number
): Promise<NextResponse> {
  let contentType = shareFile.mimeType || "application/octet-stream";
  if (!shareFile.mimeType) {
    contentType = getMimeType(path.extname(shareFile.filePath).toLowerCase());
  }
  const safeFilename = sanitizeFilenameForHeader(shareFile.originalName || "download");
  const fileStream = await getStorageReadStream(shareFile.filePath);
  const webStream = nodeStreamToWebStream(fileStream);

  const headers = new Headers();
  headers.set("Content-Length", fileSize.toString());
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set(
    "Content-Disposition",
    `${isSafeForInline(contentType) ? "inline" : "attachment"}; filename="${safeFilename}"`
  );

  return new NextResponse(webStream as ReadableStream<Uint8Array>, { status: 200, headers });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const relativePath = url.searchParams.get("relativePath");
    const token = url.searchParams.get("token") || undefined;

    if (!relativePath) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.length > 500) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const share = await prisma.share.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        password: true,
        expiresAt: true,
        isBulk: true,
        maxViews: true,
        viewCount: true,
      },
    });

    const accessError = await validateShareAccess(request, share, token);
    if (accessError) return accessError;

    const shareFile = await prisma.shareFile.findFirst({
      where: { shareId: share!.id, relativePath },
      select: { filePath: true, originalName: true, mimeType: true, size: true },
    });

    if (!shareFile || !(await storageFileExists(shareFile.filePath))) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    const fileSize = await getStorageFileSize(shareFile.filePath);
    return buildFileResponse(shareFile, fileSize);
  } catch (error) {
    console.error("File preview error:", error);
    return internalError(request);
  }
}
