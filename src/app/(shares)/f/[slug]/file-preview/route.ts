import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import path from "path";
import { getStorageReadStream, getStorageFileSize, storageFileExists } from "@/lib/storage";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { nodeStreamToWebStream } from "@/lib/stream-utils";
import { getMimeType, isSafeForInline, sanitizeFilenameForHeader } from "@/lib/mime-types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const relativePath = url.searchParams.get("relativePath");
    const password = url.searchParams.get("password") || undefined;

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
      },
    });

    if (!share || share.type !== "FILE" || !share.isBulk) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.password) {
      if (!password) {
        return apiError(request, ErrorCode.PASSWORD_REQUIRED);
      }

      const passwordValid = await bcrypt.compare(password, share.password);
      if (!passwordValid) {
        return apiError(request, ErrorCode.PASSWORD_INCORRECT);
      }
    }

    const shareFile = await prisma.shareFile.findFirst({
      where: {
        shareId: share.id,
        relativePath: relativePath,
      },
      select: {
        filePath: true,
        originalName: true,
        mimeType: true,
        size: true,
      },
    });

    if (!shareFile) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    if (!(await storageFileExists(shareFile.filePath))) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    const fileSize = await getStorageFileSize(shareFile.filePath);

    let contentType = shareFile.mimeType || "application/octet-stream";
    if (!shareFile.mimeType) {
      const ext = path.extname(shareFile.filePath).toLowerCase();
      contentType = getMimeType(ext);
    }

    const safeFilename = sanitizeFilenameForHeader(shareFile.originalName || "download");

    const fileStream = await getStorageReadStream(shareFile.filePath);
    const webStream = nodeStreamToWebStream(fileStream);

    const headers = new Headers();
    headers.set("Content-Length", fileSize.toString());
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    if (isSafeForInline(contentType)) {
      headers.set("Content-Disposition", `inline; filename="${safeFilename}"`);
    } else {
      headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
    }

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("File preview error:", error);
    return internalError(request);
  }
}
