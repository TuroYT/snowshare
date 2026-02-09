import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import path from "path";
import { existsSync, statSync, createReadStream } from "fs";
import { getUploadDir } from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { nodeStreamToWebStream } from "@/lib/stream-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    // Security: Prevent path traversal attempts and validate input
    if (relativePath.includes("..") ||
        relativePath.startsWith("/") ||
        relativePath.length > 500) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    // Get the share
    const share = await prisma.share.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        password: true,
        expiresAt: true,
        isBulk: true,
      }
    });

    if (!share || share.type !== "FILE" || !share.isBulk) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    // Check password if required
    if (share.password) {
      if (!password) {
        return apiError(request, ErrorCode.PASSWORD_REQUIRED);
      }

      const passwordValid = await bcrypt.compare(password, share.password);
      if (!passwordValid) {
        return apiError(request, ErrorCode.PASSWORD_INCORRECT);
      }
    }

    // Find the specific file in the share
    const shareFile = await prisma.shareFile.findFirst({
      where: {
        shareId: share.id,
        relativePath: relativePath
      },
      select: {
        filePath: true,
        originalName: true,
        mimeType: true,
        size: true,
      }
    });

    if (!shareFile) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    const fullPath = path.join(getUploadDir(), shareFile.filePath);

    if (!existsSync(fullPath)) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    const stats = statSync(fullPath);
    const fileSize = stats.size;

    // Determine content type from mimeType or extension
    let contentType = shareFile.mimeType || 'application/octet-stream';

    if (!shareFile.mimeType) {
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
      };
      contentType = mimeTypes[ext] || 'application/octet-stream';
    }

    // Sanitize filename for Content-Disposition header
    const safeFilename = (shareFile.originalName || 'download')
      .replace(/[\r\n]/g, '')
      .replace(/["\\/]/g, '_')
      .replace(/[^\x20-\x7E]/g, '_');

    // Stream the file
    const fileStream = createReadStream(fullPath);
    const webStream = nodeStreamToWebStream(fileStream);

    const headers = new Headers();
    headers.set('Content-Length', fileSize.toString());
    headers.set('Content-Type', contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=3600"); // Cache for 1 hour for previews

    // Allow inline viewing for images, PDFs, and videos
    if (contentType.startsWith('image/') ||
        contentType === 'application/pdf' ||
        contentType.startsWith('video/')) {
      headers.set('Content-Disposition', `inline; filename="${safeFilename}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
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
