import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "fs/promises";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { getUploadDir } from "@/lib/constants";
import { apiErrorWithStatus, ErrorCode } from "@/lib/api-errors";
import { getUploadLimits } from "@/lib/quota-shared";
import { generateSafeFilename } from "@/lib/files";
import { getMimeType } from "@/lib/mime-types";
import { deleteShareFiles } from "@/lib/storage";
import { normalizeRelativePath, validateFilePath } from "@/lib/bulk-upload-utils";
import { receiveMultipart, removeTempFiles, type ReceivedFile } from "@/lib/multipart-upload";
import {
  assertFileUploadAllowed,
  createFileShareRecord,
  moveToStorage,
  resolveUploadOptions,
  rollbackShare,
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

    const stored: { filePath: string }[] = [];
    try {
      const rows = [];
      for (const { file, relativePath } of entries) {
        const key = generateSafeFilename(file.filename, share.id, { unique: true });
        await moveToStorage(file.tempPath, key);
        stored.push({ filePath: key });
        rows.push({
          shareId: share.id,
          filePath: key,
          originalName: file.filename,
          relativePath,
          size: BigInt(file.size),
          mimeType:
            file.mimeType !== "application/octet-stream"
              ? file.mimeType
              : getMimeType(file.filename),
        });
      }
      await prisma.shareFile.createMany({ data: rows });
    } catch (error) {
      // Leave nothing behind: stored files, then the share row
      await deleteShareFiles({ files: stored });
      await rollbackShare(share.id);
      throw error;
    }

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
