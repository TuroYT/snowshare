/**
 * POST /api/v1/upload — Upload a file via multipart/form-data
 *
 * Fields:
 *   file       — the file (required)
 *   slug       — custom slug (optional)
 *   password   — password protection (optional)
 *   expiresAt  — ISO 8601 expiration date (optional)
 *   maxViews   — max view count (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "fs/promises";
import { authenticateApiRequest } from "@/lib/api-auth";
import { createFileShare } from "@/lib/shares";
import { generateSafeFilename } from "@/lib/files";
import { getClientIp } from "@/lib/getClientIp";
import { getUploadDir } from "@/lib/constants";
import { getUploadLimits } from "@/lib/quota-shared";
import { prisma } from "@/lib/prisma";
import { apiError, ErrorCode } from "@/lib/api-errors";
import {
  MultipartError,
  receiveMultipart,
  removeTempFiles,
  type ReceivedFile,
} from "@/lib/multipart-upload";
import { moveToStorage, rollbackShare, uploadErrorResponse } from "@/lib/upload-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { user } = await authenticateApiRequest(request);
  const ip = getClientIp(request);
  const isAuthenticated = user != null;

  const context = {
    userId: user?.id ?? null,
    isAuthenticated,
    ip,
  };

  const limits = await getUploadLimits(ip, isAuthenticated);
  if (limits.remainingQuotaBytes <= 0) {
    return apiError(request, ErrorCode.IP_QUOTA_EXCEEDED, { quota: limits.ipQuotaMB });
  }

  let files: ReceivedFile[] = [];
  try {
    const uploadsDir = getUploadDir();
    await mkdir(uploadsDir, { recursive: true });

    // Stream the file to disk while enforcing size limits (the body is never buffered)
    const received = await receiveMultipart(request, {
      tempDir: uploadsDir,
      maxFileBytes: limits.maxFileSizeBytes,
      maxTotalBytes: limits.remainingQuotaBytes,
      maxFiles: 1,
      acceptFile: (fieldName) => fieldName === "file",
    });
    files = received.files;
    const { fields } = received;

    const file = files[0];
    if (!file) return apiError(request, ErrorCode.FILE_REQUIRED);

    const expiresAt = fields.expiresAt ? new Date(fields.expiresAt) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      await removeTempFiles(files);
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }
    const maxViews = fields.maxViews ? parseInt(fields.maxViews, 10) : undefined;

    // Create share record with the temporary path first
    const tempKey = file.tempPath.slice(uploadsDir.length + 1);
    const result = await createFileShare({
      filename: file.filename,
      filePath: tempKey,
      size: file.size,
      context,
      expiresAt,
      slug: fields.slug || undefined,
      password: fields.password || undefined,
      maxViews,
    });

    if (result.errorCode || !result.share) {
      await removeTempFiles(files);
      return apiError(request, result.errorCode as ErrorCode, result.params);
    }

    const share = result.share;

    // Move to canonical name: {shareId}_{originalName}
    const safeFilename = generateSafeFilename(file.filename, share.id);
    try {
      await moveToStorage(file.tempPath, safeFilename);
      await prisma.share.update({
        where: { id: share.id },
        data: { filePath: safeFilename },
      });
    } catch (error) {
      await rollbackShare(share.id);
      throw error;
    }

    return NextResponse.json(
      {
        share: {
          slug: share.slug,
          url: `/f/${share.slug}`,
          expiresAt: share.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    await removeTempFiles(files);
    // Keep this endpoint's documented status codes (default ErrorCode mapping)
    if (error instanceof MultipartError && error.kind === "FILE_TOO_LARGE") {
      return apiError(request, ErrorCode.FILE_TOO_LARGE, { maxSizeMB: limits.maxFileSizeMB });
    }
    if (error instanceof MultipartError && error.kind === "TOTAL_TOO_LARGE") {
      return apiError(request, ErrorCode.IP_QUOTA_EXCEEDED, { quota: limits.ipQuotaMB });
    }
    return uploadErrorResponse(request, error, limits);
  }
}
