/**
 * GET  /r/:slug/api — Public info about an upload request
 * POST /r/:slug/api — Send files (multipart/form-data). The password, when required, is sent
 *                     in the X-Reverse-Share-Password header so it is checked before any upload.
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { getUploadDir } from "@/lib/constants";
import { apiError, apiErrorWithStatus, internalError, ErrorCode } from "@/lib/api-errors";
import { getUploadLimits } from "@/lib/quota-shared";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { accessDeniedResponse, verifySharePassword } from "@/lib/share-access";
import { normalizeRelativePath, validateFilePath } from "@/lib/bulk-upload-utils";
import { receiveMultipart, removeTempFiles, type ReceivedFile } from "@/lib/multipart-upload";
import {
  createFileShareRecord,
  MAX_NOTE_LENGTH,
  storeBulkFiles,
  uploadErrorResponse,
  UploadError,
} from "@/lib/upload-share";
import {
  claimReverseShareSlot,
  isReverseShareOpen,
  releaseReverseShareSlot,
  toPublicReverseShare,
} from "@/lib/reverse-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES_PER_SUBMISSION = 100;
const BYTES_PER_MB = 1024 * 1024;

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const rs = await prisma.reverseShare.findUnique({ where: { slug } });
    if (!rs) return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    return NextResponse.json({ data: toPublicReverseShare(rs) });
  } catch (error) {
    console.error("[GET /r/:slug/api]", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const clientIp = getClientIp(request);

  const rs = await prisma.reverseShare.findUnique({ where: { slug } });
  if (!rs) return apiError(request, ErrorCode.SHARE_NOT_FOUND);
  if (!isReverseShareOpen(rs)) return apiErrorWithStatus(request, ErrorCode.SHARE_EXPIRED, 410);

  const denied = await verifySharePassword(
    request,
    rs,
    request.headers.get("x-reverse-share-password")
  );
  if (denied) return accessDeniedResponse(request, denied);

  if (
    !(request.headers.get("content-type") || "").includes("multipart/form-data") ||
    !request.body
  ) {
    return apiErrorWithStatus(request, ErrorCode.INVALID_REQUEST, 400);
  }

  const retryAfter = consumeRateLimit("reverseShareUpload", clientIp);
  if (retryAfter > 0) return rateLimitResponse(request, retryAfter);

  // The uploader's IP quota and the per-file limit of a signed-in user apply
  const limits = await getUploadLimits(clientIp, true);
  const maxTotalBytes = Math.min(
    limits.remainingQuotaBytes,
    rs.maxSizeMB ? rs.maxSizeMB * BYTES_PER_MB : Number.POSITIVE_INFINITY
  );
  if (maxTotalBytes <= 0) {
    return apiErrorWithStatus(request, ErrorCode.IP_QUOTA_EXCEEDED, 429, {
      quota: limits.ipQuotaMB,
    });
  }

  if (!(await claimReverseShareSlot(rs.id))) {
    return apiErrorWithStatus(request, ErrorCode.SHARE_EXPIRED, 410);
  }

  let files: ReceivedFile[] = [];
  try {
    const uploadsDir = getUploadDir();
    await mkdir(uploadsDir, { recursive: true });

    const received = await receiveMultipart(request, {
      tempDir: uploadsDir,
      maxFileBytes: limits.maxFileSizeBytes,
      maxTotalBytes,
      maxFiles: MAX_FILES_PER_SUBMISSION,
    });
    files = received.files;
    if (files.length === 0) throw new UploadError(400, ErrorCode.FILE_REQUIRED);

    const entries = files.map((file) => {
      const relativePath = normalizeRelativePath(file.filename);
      if (!validateFilePath(relativePath)) throw new UploadError(400, ErrorCode.FILENAME_INVALID);
      return { file, relativePath };
    });

    const message = received.fields.message?.trim();
    const note = `${rs.name}${message ? `\n\n${message}` : ""}`.slice(0, MAX_NOTE_LENGTH);

    const share = await createFileShareRecord(
      { slug: null, passwordHash: null, expiresAt: null, maxViews: null, note },
      { clientIp, userId: rs.ownerId, isAuthenticated: true },
      { isBulk: true }
    );
    await storeBulkFiles(share.id, entries);

    return NextResponse.json({ data: { fileCount: files.length } }, { status: 201 });
  } catch (error) {
    await removeTempFiles(files);
    await releaseReverseShareSlot(rs.id);
    return uploadErrorResponse(request, error, limits);
  }
}
