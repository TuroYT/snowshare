import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createZipStream } from "@/lib/bulk-upload-utils";
import { nodeStreamToWebStream } from "@/lib/stream-utils";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { logShareAccess } from "@/lib/access-log";
import { isInitialDownloadRequest } from "@/lib/file-response";
import {
  accessDeniedResponse,
  checkShareAvailability,
  consumeView,
  verifyDownloadToken,
  verifySharePassword,
} from "@/lib/share-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;
    const token = url.searchParams.get("token");

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
        files: {
          select: { filePath: true, originalName: true, relativePath: true, size: true },
        },
      },
    });

    if (!share || share.type !== "FILE") {
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

    if (!share.isBulk || share.files.length === 0) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    // Direct downloads without a pre-counted "download" token count as a view
    if (tokenPurpose !== "download" && isInitialDownloadRequest(request)) {
      if (!(await consumeView(share.id))) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
      }
      void logShareAccess(request, share.id);
    }

    const filesForZip = share.files.map((file) => ({
      filePath: file.filePath,
      originalName: file.originalName,
      relativePath: file.relativePath || file.originalName,
    }));

    const uncompressedSize = share.files.reduce((sum, file) => sum + Number(file.size), 0);

    const zipStream = await createZipStream(filesForZip);
    const webStream = nodeStreamToWebStream(zipStream);

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${slug}_files.zip"`);
    headers.set("X-Uncompressed-Size", uncompressedSize.toString());
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return new NextResponse(webStream as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Bulk download error:", error);
    return internalError(request);
  }
}
