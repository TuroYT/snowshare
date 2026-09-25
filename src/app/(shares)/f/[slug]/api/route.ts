import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { getStorageFileSize } from "@/lib/storage";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { detectLocale, translate } from "@/lib/i18n-server";
import { logShareAccess } from "@/lib/access-log";
import {
  accessDeniedResponse,
  consumeView,
  createDownloadToken,
  DOWNLOAD_TOKEN_TTL_SECONDS,
} from "@/lib/share-access";
import { streamStoredFile } from "@/lib/file-response";
import { getClientIp } from "@/lib/getClientIp";

// Handle POST requests for file info and download actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(request, ErrorCode.INVALID_JSON);
  }

  const { action, password } = body;

  if (!action) {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }

  try {
    if (action === "info") {
      const result = await getFileShare(slug, password, { request });

      if (result.errorCode && !result.requiresPassword) {
        return accessDeniedResponse(request, {
          errorCode: result.errorCode,
          retryAfter: result.retryAfter,
        });
      }

      if (result.requiresPassword) {
        const locale = detectLocale(request);
        return NextResponse.json({
          filename: translate(locale, "api.file_protected"),
          requiresPassword: true,
          isBulk: result.isBulk || false,
        });
      }

      if (result.isBulk && result.share) {
        const files = result.share.files || [];
        const totalSize = files.reduce((sum, file) => sum + Number(file.size), 0);
        const fileList = files.map((file) => ({
          name: file.originalName,
          path: file.relativePath || file.originalName,
          size: Number(file.size),
        }));

        const locale = detectLocale(request);
        return NextResponse.json({
          filename: translate(locale, "api.file_count", { count: files.length }),
          fileSize: totalSize,
          requiresPassword: false,
          isBulk: true,
          fileCount: files.length,
          files: fileList,
          note: result.share.note ?? null,
          // Lets the page link individual files without putting the password in URLs
          accessToken: result.share.password
            ? createDownloadToken(result.share.id, "access", getClientIp(request))
            : undefined,
        });
      }

      const { storageKey, originalFilename } = result;
      if (!storageKey) {
        return apiError(request, ErrorCode.FILE_NOT_FOUND);
      }

      const fileSize = await getStorageFileSize(storageKey);

      return NextResponse.json({
        filename: originalFilename,
        fileSize,
        requiresPassword: false,
        isBulk: false,
        note: result.share?.note ?? null,
      });
    }

    if (action === "download") {
      const result = await getFileShare(slug, password, { request });

      if (result.errorCode) {
        return accessDeniedResponse(request, {
          errorCode: result.errorCode,
          retryAfter: result.retryAfter,
        });
      }

      if (!result.share || (!result.isBulk && !result.storageKey)) {
        return apiError(request, ErrorCode.FILE_NOT_FOUND);
      }

      // Count the view atomically; fails if the last view was taken concurrently
      if (!(await consumeView(result.share.id))) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
      }
      void logShareAccess(request, result.share.id);

      // The signed token replaces the password in the URL and proves the view was counted
      const rawToken = createDownloadToken(result.share.id, "download", getClientIp(request));
      const token = encodeURIComponent(rawToken);
      const downloadUrl = result.isBulk
        ? `/f/${slug}/bulk-download?token=${token}`
        : `/f/${slug}/download?token=${token}`;

      // The token also unlocks previews and individual bulk files for its lifetime
      return NextResponse.json({
        downloadUrl,
        isBulk: !!result.isBulk,
        token: rawToken,
        tokenExpiresIn: DOWNLOAD_TOKEN_TTL_SECONDS,
      });
    }

    return apiError(request, ErrorCode.INVALID_REQUEST);
  } catch (error) {
    console.error("File share error:", error);
    return internalError(request);
  }
}

// Keep GET for backward compatibility and direct downloads
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
      if (result.requiresPassword && !password) {
        const pageUrl = new URL(`/f/${slug}`, url.origin);
        return Response.redirect(pageUrl.toString(), 302);
      }

      return accessDeniedResponse(request, {
        errorCode: result.errorCode,
        retryAfter: result.retryAfter,
      });
    }

    const { storageKey, originalFilename } = result;

    if (!storageKey || !result.share) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    // Without a pre-counted "download" token every request (Range requests included) is a view
    if (result.tokenPurpose !== "download") {
      if (!(await consumeView(result.share.id))) {
        return apiError(request, ErrorCode.SHARE_EXPIRED);
      }
      void logShareAccess(request, result.share.id);
    }

    return streamStoredFile(request, {
      key: storageKey,
      filename: originalFilename || "download",
      disposition: "inline-when-browsing",
    });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
