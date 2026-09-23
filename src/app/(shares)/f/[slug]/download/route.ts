import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { detectLocale, translate } from "@/lib/i18n-server";
import { logShareAccess } from "@/lib/access-log";
import { accessDeniedResponse, consumeView } from "@/lib/share-access";
import { isInitialDownloadRequest, streamStoredFile } from "@/lib/file-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  try {
    const url = new URL(request.url);
    const password = url.searchParams.get("password") || undefined;
    const token = url.searchParams.get("token");

    const result = await getFileShare(slug, password, { request, token });

    if (result.errorCode) {
      return accessDeniedResponse(request, {
        errorCode: result.errorCode,
        retryAfter: result.retryAfter,
      });
    }

    if (result.share?.isBulk) {
      return NextResponse.json(
        {
          error: translate(detectLocale(request), "api.errors.bulk_share_use_bulk_download"),
          isBulk: true,
        },
        { status: 400 }
      );
    }

    const { storageKey, originalFilename } = result;

    if (!storageKey || !result.share) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    // Downloads without a pre-counted "download" token count as a view
    if (result.tokenPurpose !== "download" && isInitialDownloadRequest(request)) {
      if (!(await consumeView(result.share.id))) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
      }
      void logShareAccess(request, result.share.id);
    }

    return streamStoredFile(request, {
      key: storageKey,
      filename: originalFilename || "download",
      disposition: "attachment",
    });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
