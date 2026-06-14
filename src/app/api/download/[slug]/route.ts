import { NextRequest } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { validateDownloadToken } from "@/lib/download-token";
import { serveFileResponse } from "@/lib/file-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const token = new URL(request.url).searchParams.get("token") || undefined;

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

    if (share.password && (!token || !validateDownloadToken(token, share.id))) {
      return apiError(request, ErrorCode.DOWNLOAD_TOKEN_INVALID);
    }

    if (!share.filePath) {
      return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
    }

    const originalFilename = share.filePath.split("_").slice(1).join("_");
    return serveFileResponse(request, share.filePath, originalFilename, { allowInline: true });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
