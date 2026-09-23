/**
 * Shared logic for turning uploaded files into FILE shares.
 * Used by the tus server (server.js), /api/upload, /api/upload/bulk and /api/v1/upload.
 */

import { rename, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { apiErrorWithStatus, ErrorCode, internalError, type ErrorParams } from "@/lib/api-errors";
import { MultipartError } from "@/lib/multipart-upload";
import { getUploadDir, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { getSettingsCached } from "@/lib/settings";
import { isS3Enabled, uploadToStorage } from "@/lib/storage";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import {
  generateRandomSlug,
  getMaxAnonExpiry,
  hashPassword,
  isValidSlug,
  MAX_ANON_EXPIRY_DAYS,
} from "@/lib/security";

export const MAX_NOTE_LENGTH = 2000;

/** Error carrying the HTTP status and translated error code to return to the client. */
export class UploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly params?: ErrorParams
  ) {
    super(code);
    this.name = "UploadError";
  }
}

export interface UploadContext {
  clientIp: string;
  userId: string | null;
  isAuthenticated: boolean;
}

export interface RawUploadOptions {
  slug?: string | null;
  password?: string | null;
  expiresAt?: string | Date | null;
  maxViews?: number | string | null;
  note?: string | null;
}

export interface ResolvedUploadOptions {
  slug: string | null;
  passwordHash: string | null;
  expiresAt: Date | null;
  maxViews: number | null;
  note: string | null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Rejects anonymous uploads when the admin disabled anonymous file sharing. */
export async function assertFileUploadAllowed(context: UploadContext): Promise<void> {
  if (context.isAuthenticated) return;
  const settings = await getSettingsCached();
  if (settings && !settings.allowAnonFileShare) {
    throw new UploadError(403, ErrorCode.ANON_FILE_SHARE_DISABLED);
  }
}

export interface ValidatedUploadOptions {
  slug: string | null;
  password: string | null;
  expiresAt: Date | null;
  maxViews: number | null;
  note: string | null;
}

/**
 * Validates and normalizes user-supplied share options (no hashing, cheap to call early).
 *
 * Anonymous expiration: "clamp" silently caps it to the maximum (tus behaviour),
 * "reject" returns EXPIRATION_TOO_FAR (multipart endpoints behaviour).
 */
export async function validateUploadOptions(
  raw: RawUploadOptions,
  context: UploadContext,
  {
    anonExpiry = "reject",
    checkSlugAvailability = true,
  }: {
    anonExpiry?: "clamp" | "reject";
    checkSlugAvailability?: boolean;
  } = {}
): Promise<ValidatedUploadOptions> {
  const slug = raw.slug?.trim() || null;
  if (slug && !isValidSlug(slug)) {
    throw new UploadError(400, ErrorCode.SLUG_INVALID);
  }
  if (slug && checkSlugAvailability) {
    const existing = await prisma.share.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new UploadError(409, ErrorCode.SLUG_ALREADY_TAKEN);
  }

  let expiresAt: Date | null = null;
  if (raw.expiresAt) {
    expiresAt = new Date(raw.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      if (anonExpiry === "reject") throw new UploadError(400, ErrorCode.INVALID_DATE_FORMAT);
      expiresAt = null;
    }
  }
  if (!context.isAuthenticated) {
    const maxExpiry = getMaxAnonExpiry();
    if (!expiresAt) {
      expiresAt = maxExpiry;
    } else if (expiresAt > maxExpiry) {
      if (anonExpiry === "reject") {
        throw new UploadError(400, ErrorCode.EXPIRATION_TOO_FAR, { days: MAX_ANON_EXPIRY_DAYS });
      }
      expiresAt = maxExpiry;
    }
  }

  const password = raw.password?.trim() || null;
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    throw new UploadError(400, ErrorCode.PASSWORD_INVALID_LENGTH, {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    });
  }

  const maxViewsNumber =
    typeof raw.maxViews === "string" ? parseInt(raw.maxViews, 10) : (raw.maxViews ?? null);
  const maxViews =
    maxViewsNumber && Number.isInteger(maxViewsNumber) && maxViewsNumber > 0
      ? maxViewsNumber
      : null;

  return {
    slug,
    password,
    expiresAt,
    maxViews,
    note: raw.note?.slice(0, MAX_NOTE_LENGTH) || null,
  };
}

/** Validates the options and hashes the password, ready for createFileShareRecord(). */
export async function resolveUploadOptions(
  raw: RawUploadOptions,
  context: UploadContext,
  validation?: Parameters<typeof validateUploadOptions>[2]
): Promise<ResolvedUploadOptions> {
  const { password, ...options } = await validateUploadOptions(raw, context, validation);
  return { ...options, passwordHash: password ? await hashPassword(password) : null };
}

/**
 * Creates the FILE share row. A slug taken concurrently is reported as SLUG_ALREADY_TAKEN.
 */
export async function createFileShareRecord(
  options: ResolvedUploadOptions,
  context: UploadContext,
  { isBulk, size }: { isBulk: boolean; size?: number | null }
) {
  const slug =
    options.slug ??
    (await generateRandomSlug(
      async (s) => !!(await prisma.share.findUnique({ where: { slug: s }, select: { id: true } }))
    ));

  try {
    const share = await prisma.share.create({
      data: {
        slug,
        type: "FILE",
        filePath: isBulk ? null : "",
        size: !isBulk && size != null ? BigInt(size) : null,
        password: options.passwordHash,
        expiresAt: options.expiresAt,
        ipSource: context.clientIp,
        ownerId: context.userId,
        isBulk,
        maxViews: options.maxViews,
        note: options.note,
      },
    });
    lookupIpGeolocation(context.clientIp);
    return share;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UploadError(409, ErrorCode.SLUG_ALREADY_TAKEN);
    }
    throw error;
  }
}

/**
 * Moves a finished temporary file to its final storage key:
 * uploaded to S3 when enabled (then removed locally), otherwise renamed into the upload dir.
 */
export async function moveToStorage(tempPath: string, key: string): Promise<void> {
  if (await isS3Enabled()) {
    await uploadToStorage(tempPath, key);
    await unlink(tempPath).catch((error) => {
      console.error(`Upload: failed to remove temp file ${tempPath} after S3 upload:`, error);
    });
    return;
  }
  await rename(tempPath, path.join(getUploadDir(), key));
}

/** Deletes a share created for an upload that could not be finalized. */
export async function rollbackShare(shareId: string): Promise<void> {
  await prisma.share.delete({ where: { id: shareId } }).catch((error) => {
    console.error(`Upload: failed to roll back share ${shareId}:`, error);
  });
}

const BYTES_PER_MB = 1024 * 1024;

/**
 * Translated error response for upload failures (UploadError, MultipartError or unexpected).
 */
export function uploadErrorResponse(
  request: NextRequest,
  error: unknown,
  limits?: { maxFileSizeBytes: number; ipQuotaBytes: number }
) {
  if (error instanceof UploadError) {
    return apiErrorWithStatus(request, error.code, error.status, error.params);
  }
  if (error instanceof MultipartError) {
    switch (error.kind) {
      case "FILE_TOO_LARGE":
        return apiErrorWithStatus(request, ErrorCode.FILE_TOO_LARGE, 413, {
          maxSizeMB: limits ? Math.round(limits.maxFileSizeBytes / BYTES_PER_MB) : undefined,
        });
      case "TOTAL_TOO_LARGE":
        return apiErrorWithStatus(request, ErrorCode.IP_QUOTA_EXCEEDED, 429, {
          quota: limits ? Math.round(limits.ipQuotaBytes / BYTES_PER_MB) : undefined,
        });
      case "TOO_MANY_FILES":
        return apiErrorWithStatus(request, ErrorCode.TOO_MANY_FILES, 400);
      case "INVALID_FILENAME":
        return apiErrorWithStatus(request, ErrorCode.FILENAME_INVALID, 400);
      default:
        console.error("Upload: malformed multipart request:", error.cause ?? error);
        return apiErrorWithStatus(request, ErrorCode.INVALID_REQUEST, 400);
    }
  }
  console.error("Upload: unexpected error:", error);
  return internalError(request);
}
