import { NextRequest, NextResponse } from "next/server";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { getStorageFileSize } from "@/lib/storage";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { detectLocale, translate } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { logShareAccess } from "@/lib/access-log";
import { issueDownloadToken } from "@/lib/download-token";
import { serveFileResponse } from "@/lib/file-response";

async function handleInfo(request: NextRequest, slug: string): Promise<NextResponse> {
  const result = await getFileShare(slug);

  if (result.errorCode && !result.requiresPassword) {
    return apiError(request, result.errorCode);
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
    const totalSize = files.reduce(
      (sum: number, file: { size: bigint }) => sum + Number(file.size),
      0
    );
    return NextResponse.json({
      filename: `${files.length} files`,
      fileSize: totalSize,
      requiresPassword: false,
      isBulk: true,
      fileCount: files.length,
      files: files.map((file) => ({
        name: file.originalName,
        path: file.relativePath || file.originalName,
        size: Number(file.size),
      })),
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
  });
}

async function handleDownload(
  request: NextRequest,
  slug: string,
  password: string | undefined
): Promise<NextResponse> {
  const result = await getFileShare(slug, password);

  if (result.errorCode) {
    return apiError(request, result.errorCode);
  }

  if (result.share) {
    await prisma.share.update({
      where: { id: result.share.id },
      data: { viewCount: { increment: 1 } },
    });
    void logShareAccess(request, result.share.id);
  }

  const token = issueDownloadToken(result.share!.id);

  if (result.isBulk) {
    return NextResponse.json({
      downloadUrl: `/f/${slug}/bulk-download?token=${token}`,
      isBulk: true,
    });
  }

  if (!result.storageKey) {
    return apiError(request, ErrorCode.FILE_NOT_FOUND);
  }

  return NextResponse.json({ downloadUrl: `/f/${slug}/download?token=${token}`, isBulk: false });
}

async function handlePreviewToken(
  request: NextRequest,
  slug: string,
  password: string | undefined
): Promise<NextResponse> {
  const result = await getFileShare(slug, password);

  if (result.errorCode) {
    return apiError(request, result.errorCode);
  }

  return NextResponse.json({ token: issueDownloadToken(result.share!.id) });
}

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
    if (action === "info") return handleInfo(request, slug);
    if (action === "download") return handleDownload(request, slug, password);
    if (action === "preview-token") return handlePreviewToken(request, slug, password);
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

    const result = await getFileShare(slug, password);

    if (result.errorCode) {
      if (result.requiresPassword && !password) {
        return Response.redirect(new URL(`/f/${slug}`, url.origin).toString(), 302);
      }
      return apiError(request, result.errorCode);
    }

    const { storageKey, originalFilename } = result;

    if (!storageKey) {
      return apiError(request, ErrorCode.FILE_NOT_FOUND);
    }

    return serveFileResponse(request, storageKey, originalFilename || "download", {
      allowInline: true,
    });
  } catch (error) {
    console.error("Download error:", error);
    return internalError(request);
  }
}
