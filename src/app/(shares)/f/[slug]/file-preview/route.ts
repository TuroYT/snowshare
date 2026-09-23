import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageFileExists } from "@/lib/storage";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { streamStoredFile } from "@/lib/file-response";
import {
  accessDeniedResponse,
  checkShareAvailability,
  verifyDownloadToken,
  verifySharePassword,
} from "@/lib/share-access";

/**
 * Serves one file of a bulk share, for preview or individual download.
 * Individual files do not consume a view; exhausted shares are refused.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const relativePath = url.searchParams.get("relativePath");
    const password = url.searchParams.get("password") || undefined;
    const token = url.searchParams.get("token");
    const forceDownload = url.searchParams.get("download") === "1";

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
        maxViews: true,
        viewCount: true,
        isBulk: true,
      },
    });

    if (!share || share.type !== "FILE" || !share.isBulk) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    const tokenPurpose = verifyDownloadToken(token, share.id);

    const unavailable = checkShareAvailability(share, {
      ignoreViewLimit: tokenPurpose === "download",
    });
    if (unavailable) return accessDeniedResponse(request, unavailable);

    if (!tokenPurpose) {
      const denied = await verifySharePassword(request, share, password);
      if (denied) return accessDeniedResponse(request, denied);
    }

    const shareFile = await prisma.shareFile.findFirst({
      where: { shareId: share.id, relativePath },
      select: { filePath: true, originalName: true, mimeType: true, size: true },
    });

    if (!shareFile || !(await storageFileExists(shareFile.filePath))) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    return streamStoredFile(request, {
      key: shareFile.filePath,
      filename: shareFile.originalName || "download",
      contentType: shareFile.mimeType,
      size: Number(shareFile.size),
      disposition: forceDownload ? "attachment" : "inline-when-safe",
    });
  } catch (error) {
    console.error("File preview error:", error);
    return internalError(request);
  }
}
