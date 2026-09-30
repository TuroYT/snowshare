/**
 * File upload endpoint (multipart/form-data, optionally chunked).
 * The web UI uses the tus endpoint (/api/tus); this route is kept for API clients.
 *
 * Chunked uploads send X-Upload-Id, X-Chunk-Index and X-Total-Chunks headers; chunks are
 * appended to a session file until the last one, which creates the share.
 */

import { NextRequest, NextResponse } from "next/server";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadDir } from "@/lib/constants";
import { getClientIp } from "@/lib/getClientIp";
import { apiErrorWithStatus, ErrorCode } from "@/lib/api-errors";
import { getUploadLimits } from "@/lib/quota-shared";
import { generateSafeFilename } from "@/lib/files";
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

// Force Node.js runtime (not Edge)
export const runtime = "nodejs";

// Disable static optimization
export const dynamic = "force-dynamic";

/**
 * Session file for a chunked upload. The name is derived from the client-supplied upload id
 * AND the uploader identity, so another client reusing the id gets a different file.
 */
function chunkSessionPath(uploadsDir: string, uploadId: string, context: UploadContext): string {
  const owner = context.userId ?? `ip:${context.clientIp}`;
  const digest = crypto.createHash("sha256").update(`${uploadId}:${owner}`).digest("hex");
  return path.join(uploadsDir, `temp_upload_${digest.slice(0, 32)}`);
}

async function fileSizeOrNull(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

type ChunkInfo = { isChunked: boolean; uploadId: string | null; index: number; total: number };

/** Parses the chunk headers. Returns null when they are present but invalid. */
function parseChunkInfo(req: NextRequest): ChunkInfo | null {
  const chunkIndexHeader = req.headers.get("x-chunk-index");
  const totalChunksHeader = req.headers.get("x-total-chunks");
  const uploadId = req.headers.get("x-upload-id");

  if (chunkIndexHeader === null || totalChunksHeader === null || uploadId === null) {
    return { isChunked: false, uploadId: null, index: 0, total: 1 };
  }

  const index = Number.parseInt(chunkIndexHeader, 10);
  const total = Number.parseInt(totalChunksHeader, 10);
  const valid =
    /^[a-zA-Z0-9-]{1,100}$/.test(uploadId) &&
    Number.isInteger(index) &&
    Number.isInteger(total) &&
    index >= 0 &&
    total >= 1 &&
    index < total;

  return valid ? { isChunked: true, uploadId, index, total } : null;
}

/** Creates the share for a completely received file and moves it to storage. */
async function finalizeUpload(
  req: NextRequest,
  context: UploadContext,
  file: ReceivedFile,
  fields: Record<string, string>,
  pending: { tempPath: string | null }
): Promise<NextResponse> {
  const totalSize = (await fileSizeOrNull(pending.tempPath!)) ?? 0;

  const options = await resolveUploadOptions(
    { slug: fields.slug, password: fields.password, expiresAt: fields.expiresAt },
    context
  );

  const share = await createFileShareRecord(options, context, {
    isBulk: false,
    size: totalSize,
  });

  const finalFileName = generateSafeFilename(file.filename, share.id);
  try {
    await moveToStorage(pending.tempPath!, finalFileName);
    pending.tempPath = null; // moved: nothing to clean up
    await prisma.share.update({
      where: { id: share.id },
      data: { filePath: finalFileName },
    });
  } catch (error) {
    await rollbackShare(share.id);
    throw error;
  }

  return NextResponse.json(
    {
      share: {
        slug: share.slug,
        type: share.type,
        filename: file.filename,
        expiresAt: share.expiresAt,
        hasPassword: !!share.password,
      },
    },
    { status: 201 }
  );
}

async function removeSessionFile(filePath: string) {
  await unlink(filePath).catch((unlinkError: NodeJS.ErrnoException) => {
    if (unlinkError.code !== "ENOENT") {
      console.error("Upload: failed to remove session file:", unlinkError);
    }
  });
}

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

  const chunk = parseChunkInfo(req);
  if (!chunk) {
    return apiErrorWithStatus(req, ErrorCode.INVALID_REQUEST, 400);
  }
  const { index: chunkIndex, total: totalChunks } = chunk;

  const limits = await getUploadLimits(context.clientIp, context.isAuthenticated);
  const uploadsDir = getUploadDir();
  const sessionPath = chunk.uploadId ? chunkSessionPath(uploadsDir, chunk.uploadId, context) : null;

  let received: ReceivedFile[] = [];
  const pending: { tempPath: string | null } = { tempPath: null };

  try {
    await assertFileUploadAllowed(context);

    // Quota is fully exhausted: reject before receiving anything (new uploads only)
    if (chunkIndex === 0 && limits.remainingQuotaBytes <= 0) {
      throw new UploadError(429, ErrorCode.IP_QUOTA_EXCEEDED, { quota: limits.ipQuotaMB });
    }

    await mkdir(uploadsDir, { recursive: true });

    // Bytes already received for this chunked upload
    let alreadyReceived = 0;
    if (sessionPath && chunkIndex > 0) {
      const size = await fileSizeOrNull(sessionPath);
      if (size === null) throw new UploadError(400, ErrorCode.INVALID_REQUEST);
      alreadyReceived = size;
    }

    const effectiveMaxBytes = Math.min(limits.maxFileSizeBytes, limits.remainingQuotaBytes);
    const result = await receiveMultipart(req, {
      tempDir: uploadsDir,
      maxFileBytes: Math.max(0, limits.maxFileSizeBytes - alreadyReceived),
      maxTotalBytes: Math.max(0, effectiveMaxBytes - alreadyReceived),
      maxFiles: 1,
      acceptFile: (fieldName) => fieldName === "file",
    });
    received = result.files;

    const file = received[0];
    if (!file) throw new UploadError(400, ErrorCode.FILE_REQUIRED);

    if (sessionPath) {
      // Append this chunk to the session file (first chunk truncates any stale content)
      await pipeline(
        createReadStream(file.tempPath),
        createWriteStream(sessionPath, { flags: chunkIndex === 0 ? "w" : "a" })
      );
      await removeTempFiles(received);
      received = [];

      if (chunkIndex < totalChunks - 1) {
        return NextResponse.json(
          { status: "chunk_received", index: chunkIndex, nextIndex: chunkIndex + 1 },
          { status: 201 }
        );
      }
      pending.tempPath = sessionPath;
    } else {
      pending.tempPath = file.tempPath;
    }

    // --- Finalize (single request or last chunk) ---
    return await finalizeUpload(req, context, file, result.fields, pending);
  } catch (error) {
    await removeTempFiles(received);
    if (pending.tempPath) {
      await removeSessionFile(pending.tempPath);
    }
    return uploadErrorResponse(req, error, limits);
  }
}
