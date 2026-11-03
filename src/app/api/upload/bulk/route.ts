import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "node:fs/promises";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";
import { getUploadDir } from "@/lib/constants";
import { apiErrorWithStatus, ErrorCode } from "@/lib/api-errors";
import { getUploadLimits } from "@/lib/quota-shared";
import { normalizeRelativePath, validateFilePath } from "@/lib/bulk-upload-utils";
import { receiveMultipart, removeTempFiles, type ReceivedFile } from "@/lib/multipart-upload";
import {
  assertFileUploadAllowed,
  createFileShareRecord,
  resolveUploadOptions,
  storeBulkFiles,
  uploadErrorResponse,
  UploadError,
  type UploadContext,
} from "@/lib/upload-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upper bound on files per bulk request (the tus endpoint has no such limit) */
const MAX_FILES_PER_REQUEST = 1000;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return apiErrorWithStatus(req, ErrorCode.INVALID_REQUEST, 400);
  }

  if (!req.body) {
    return apiErrorWithStatus(req, ErrorCode.MISSING_DATA, 400);
  }

  const session = await getServerSession(authOptions);
  const context: UploadContext = {
    clientIp: getClientIp(req),
    userId: session?.user?.id ?? null,
    isAuthenticated: !!session?.user,
  };

  const limits = await getUploadLimits(context.clientIp, context.isAuthenticated);

  let files: ReceivedFile[] = [];
  try {
    await assertFileUploadAllowed(context);

    if (limits.remainingQuotaBytes <= 0) {
      throw new UploadError(429, ErrorCode.IP_QUOTA_EXCEEDED, {
        quota: limits.ipQuotaMB,
      });
    }

    const uploadsDir = getUploadDir();
    await mkdir(uploadsDir, { recursive: true });

    // Files are streamed to temporary files on disk, never buffered in memory
    const received = await receiveMultipart(req, {
      tempDir: uploadsDir,
      maxFileBytes: limits.maxFileSizeBytes,
      maxTotalBytes: limits.remainingQuotaBytes,
      maxFiles: MAX_FILES_PER_REQUEST,
    });
    files = received.files;
    const { fields } = received;

    if (files.length === 0) {
      throw new UploadError(400, ErrorCode.FILE_REQUIRED);
    }

    // Relative paths are sent as "<field>_path" fields
    const entries = files.map((file) => {
      const relativePath = normalizeRelativePath(fields[`${file.fieldName}_path`] || file.filename);
      if (!validateFilePath(relativePath)) {
        throw new UploadError(400, ErrorCode.FILENAME_INVALID);
      }
      return { file, relativePath };
    });

    const options = await resolveUploadOptions(
      { slug: fields.slug, password: fields.password, expiresAt: fields.expiresAt },
      context
    );

    const share = await createFileShareRecord(options, context, { isBulk: true });

    await storeBulkFiles(share.id, entries);

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    return NextResponse.json(
      {
        share: {
          slug: share.slug,
          type: share.type,
          isBulk: true,
          fileCount: files.length,
          totalSize,
          expiresAt: share.expiresAt,
          hasPassword: !!share.password,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    await removeTempFiles(files);
    return uploadErrorResponse(req, error, limits);
  }
}
