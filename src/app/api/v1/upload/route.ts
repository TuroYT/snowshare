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
import { mkdir, rename, unlink } from "fs/promises";
import { existsSync, createWriteStream } from "fs";
import { Readable } from "stream";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { authenticateApiRequest } from "@/lib/api-auth";
import { createFileShare } from "@/lib/shares";
import { generateSafeFilename } from "@/lib/files";
import { getClientIp } from "@/lib/getClientIp";
import { getUploadDir } from "@/lib/constants";
import { getUploadLimits } from "@/lib/quota-shared";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const { user } = await authenticateApiRequest(request);
    const ip = getClientIp(request);
    const isAuthenticated = user != null;

    const context = {
      userId: user?.id ?? null,
      isAuthenticated,
      ip,
    };

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const file = formData.get("file") as File | null;
    if (!file) return apiError(request, ErrorCode.FILE_REQUIRED);

    const slug = (formData.get("slug") as string) || undefined;
    const password = (formData.get("password") as string) || undefined;
    const expiresAtRaw = formData.get("expiresAt") as string | null;
    const maxViewsRaw = formData.get("maxViews") as string | null;

    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }
    const maxViews = maxViewsRaw ? parseInt(maxViewsRaw, 10) : undefined;

    // Check quota / size limits
    const limits = await getUploadLimits(ip, isAuthenticated);
    const fileSizeBytes = file.size;

    if (fileSizeBytes > limits.maxFileSizeBytes) {
      return apiError(request, ErrorCode.FILE_TOO_LARGE);
    }
    if (fileSizeBytes > limits.remainingQuotaBytes) {
      return apiError(request, ErrorCode.IP_QUOTA_EXCEEDED);
    }

    // Ensure uploads directory exists
    const uploadsDir = getUploadDir();
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Write file to disk via streaming (avoids loading entire file into memory)
    const tmpName = `tmp_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const tmpPath = path.join(uploadsDir, tmpName);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(tmpPath);
      const nodeStream = Readable.fromWeb(file.stream() as import("stream/web").ReadableStream);
      nodeStream.pipe(ws);
      ws.on("finish", resolve);
      ws.on("error", reject);
      nodeStream.on("error", reject);
    });

    // Create share record with the temporary path first
    const result = await createFileShare({
      filename: file.name,
      filePath: tmpName,
      context,
      expiresAt,
      slug,
      password,
      maxViews,
    });

    if (result.errorCode) {
      unlink(tmpPath).catch(() => {});
      return apiError(request, result.errorCode as ErrorCode);
    }

    const share = result.share!;

    // Rename to canonical name: {shareId}_{originalName}
    const safeFilename = generateSafeFilename(file.name, share.id);
    const finalPath = path.join(uploadsDir, safeFilename);

    // Rename + DB update: clean up on failure to keep FS and DB consistent
    const { prisma } = await import("@/lib/prisma");
    try {
      await rename(tmpPath, finalPath);
      await prisma.share.update({
        where: { id: share.id },
        data: { filePath: safeFilename },
      });
    } catch (fsErr) {
      // Roll back: delete share record and temp file
      await prisma.share.delete({ where: { id: share.id } }).catch(() => {});
      unlink(tmpPath).catch(() => {});
      unlink(finalPath).catch(() => {});
      throw fsErr;
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
    console.error("[POST /api/v1/upload]", error);
    return internalError(request);
  }
}
