/**
 * Server-side logic of the resumable (tus) uploads, kept out of server.js so it can be tested.
 *
 * This module is loaded by server.js (run with tsx), so it only uses Node built-ins and
 * relative `./x.js` specifiers: the `@/` alias is not available here.
 */
import path from "node:path";
import { unlink } from "node:fs/promises";

// Upload metadata keys written by the server (they override any client-supplied value)
export const CTX_IP = "ss_ip";
export const CTX_USER = "ss_user";
export const CTX_AUTH = "ss_auth";

export type UploadMetadata = Record<string, string | null | undefined>;

export interface TusUploadContext {
  clientIp: string;
  userId: string | null;
  isAuthenticated: boolean;
  timestamp?: number;
}

export interface TusRequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

export interface TusUpload {
  id: string;
  size?: number | null;
  offset?: number;
  metadata?: UploadMetadata;
}

export interface TusAuthResult {
  userId: string | null;
  isAuthenticated: boolean;
  retryAfter?: number;
}

export interface TusError extends Error {
  status_code: number;
  body: string;
}

type UploadErrorClass = abstract new (...args: never[]) => Error;

interface ShareRecord {
  id: string;
  slug: string;
  expiresAt?: Date | null;
  isBulk?: boolean;
  ownerId?: string | null;
  ipSource?: string | null;
}

/** The subset of the shared libs (prisma, upload-share, quota-shared, files, storage, webhooks) used here. */
export interface TusLibs {
  prisma: {
    share: {
      findUnique(args: { where: { id: string } }): Promise<ShareRecord | null>;
      update(args: { where: { id: string }; data: { filePath: string } }): Promise<unknown>;
    };
    shareFile: {
      create(args: {
        data: {
          shareId: string;
          filePath: string;
          originalName: string;
          relativePath: string;
          size: bigint;
          mimeType: string;
        };
      }): Promise<unknown>;
    };
  };
  getUploadLimits(
    clientIp: string,
    isAuthenticated: boolean
  ): Promise<{ maxFileSizeBytes: number; remainingQuotaBytes: number }>;
  assertFileUploadAllowed(context: TusUploadContext): Promise<void>;
  validateUploadOptions(
    raw: RawUploadOptions,
    context: TusUploadContext,
    validation: { anonExpiry: "clamp" | "reject" }
  ): Promise<unknown>;
  resolveUploadOptions(
    raw: RawUploadOptions,
    context: TusUploadContext,
    validation: { anonExpiry: "clamp" | "reject" }
  ): Promise<unknown>;
  createFileShareRecord(
    options: unknown,
    context: TusUploadContext,
    info: { isBulk: boolean; size: number }
  ): Promise<ShareRecord>;
  generateSafeFilename(
    originalName: string,
    shareId: string,
    options: { unique?: boolean }
  ): string;
  moveToStorage(tempPath: string, key: string): Promise<void>;
  deleteFromStorage(key: string): Promise<unknown>;
  emitShareEvent(event: "share.created", share: ShareRecord): Promise<unknown>;
  rollbackShare(shareId: string): Promise<void>;
  UploadError: UploadErrorClass & { prototype: Error & { status: number; code: string } };
}

export interface RawUploadOptions {
  slug?: string | null;
  password?: string | null;
  expiresAt?: string | null;
  maxViews?: string | null;
  note?: string | null;
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    const value = parts.slice(1).join("=").trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

// NextAuth JWT or `Bearer sk_...` API key
export async function authenticateFromRequest(
  req: TusRequestLike,
  clientIp: string
): Promise<TusAuthResult> {
  const authHeader = (req.headers?.authorization as string | undefined) || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    if (rawKey.startsWith("sk_")) {
      // Same invalid-key throttling as the Next.js API routes (shared in-memory store)
      const { getRetryAfter, recordRateLimitHit } = await import("./rate-limit.js");
      const retryAfter = getRetryAfter("apiKey", clientIp);
      if (retryAfter > 0) {
        return { userId: null, isAuthenticated: false, retryAfter };
      }
      try {
        const { prisma } = await import("./prisma.js");
        const { hashApiKey } = await import("./security.js");
        const keyHash = hashApiKey(rawKey);
        const apiKey = await prisma.apiKey.findUnique({
          where: { keyHash },
          select: { id: true, userId: true, expiresAt: true },
        });
        if (apiKey && (!apiKey.expiresAt || apiKey.expiresAt > new Date())) {
          // Fire and forget
          prisma.apiKey
            .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
            .catch((err: Error) =>
              console.warn("[Auth] Failed to update lastUsedAt:", err.message)
            );
          return { userId: apiKey.userId, isAuthenticated: true };
        }
        recordRateLimitHit("apiKey", clientIp);
      } catch (error) {
        console.error("[Auth] API key lookup error:", (error as Error).message);
      }
    }
  }

  try {
    const { getToken } = await import("next-auth/jwt");
    const cookies = parseCookies((req.headers?.cookie as string | undefined) || "");
    const token = await getToken({
      req: {
        headers: req.headers || {},
        cookies,
      } as unknown as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (token?.id) {
      return {
        userId: token.id as string,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    console.error("[Auth] Error:", (error as Error).message);
  }

  return {
    userId: null,
    isAuthenticated: false,
  };
}

/**
 * Builds an Error carrying the { status_code, body } properties tus-node-server reads to
 * build the HTTP response.
 */
export function tusError(status_code: number, body: string): TusError {
  return Object.assign(new Error(body), { status_code, body });
}

/** Converts an error to the { status_code, body } shape tus-node-server returns to clients. */
export function toTusError(error: unknown, UploadError?: UploadErrorClass): TusError {
  if (error && typeof error === "object" && "status_code" in error) return error as TusError;
  if (UploadError && error instanceof UploadError) {
    const { status, code } = error as unknown as { status: number; code: string };
    return tusError(status, JSON.stringify({ error: code }));
  }
  console.error("[Upload] Unexpected error:", error);
  return tusError(500, JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }));
}

/** Upload context persisted in the upload metadata at creation (survives restarts). */
export function readUploadContext(metadata: UploadMetadata | undefined): TusUploadContext | null {
  if (metadata?.[CTX_AUTH] === undefined) return null;
  return {
    clientIp: metadata[CTX_IP] as string,
    userId: metadata[CTX_USER] || null,
    isAuthenticated: metadata[CTX_AUTH] === "1",
  };
}

/**
 * Enforces the per-file size limit and the IP quota for an upload of `size` bytes.
 * Fails closed: if usage cannot be computed, the upload is refused.
 */
export async function assertWithinLimits(
  libs: Pick<TusLibs, "getUploadLimits">,
  context: TusUploadContext,
  size: number
): Promise<void> {
  let limits;
  try {
    limits = await libs.getUploadLimits(context.clientIp, context.isAuthenticated);
  } catch (error) {
    console.error("[Upload] Cannot compute upload limits, refusing upload:", error);
    throw tusError(503, JSON.stringify({ error: "QUOTA_UNAVAILABLE" }));
  }
  if (size > limits.maxFileSizeBytes) {
    throw tusError(413, JSON.stringify({ error: "FILE_TOO_LARGE" }));
  }
  if (size > limits.remainingQuotaBytes) {
    throw tusError(429, JSON.stringify({ error: "IP_QUOTA_EXCEEDED" }));
  }
}

export function isBulkSubsequentFile(metadata: UploadMetadata): boolean {
  return (
    metadata.isBulk === "true" &&
    (!!metadata.bulkShareId ||
      (!!metadata.fileIndex && Number.parseInt(metadata.fileIndex, 10) > 0))
  );
}

export function rawUploadOptions(metadata: UploadMetadata): RawUploadOptions {
  return {
    slug: metadata.slug,
    password: metadata.password,
    expiresAt: metadata.expiresAt,
    maxViews: metadata.maxViews,
    note: metadata.note,
  };
}

/** Returns the existing bulk share for a subsequent file, after checking the uploader owns it. */
export async function getOwnedBulkShare(
  libs: Pick<TusLibs, "prisma">,
  bulkShareId: string,
  context: TusUploadContext
): Promise<ShareRecord> {
  const share = await libs.prisma.share.findUnique({ where: { id: bulkShareId } });
  if (!share?.isBulk) {
    console.error(`[Upload] Bulk share not found: ${bulkShareId}`);
    throw tusError(404, JSON.stringify({ error: "SHARE_NOT_FOUND" }));
  }
  const ownsShare = context.isAuthenticated
    ? share.ownerId === context.userId
    : !share.ownerId && share.ipSource === context.clientIp;
  if (!ownsShare) {
    const uploader = context.isAuthenticated ? `user ${context.userId}` : `IP ${context.clientIp}`;
    console.error(`[Upload] Unauthorized bulk share access: ${bulkShareId} by ${uploader}`);
    throw tusError(403, JSON.stringify({ error: "UNAUTHORIZED_SHARE_ACCESS" }));
  }
  return share;
}

/** Links the stored file to its share; removes the file from storage if that fails. */
export async function recordStoredFile(
  libs: Pick<TusLibs, "prisma" | "deleteFromStorage">,
  share: ShareRecord,
  finalFileName: string,
  info: { filename: string; relativePath: string; size: number; mimeType?: string | null }
): Promise<void> {
  const { filename, relativePath, size, mimeType } = info;
  try {
    if (share.isBulk) {
      await libs.prisma.shareFile.create({
        data: {
          shareId: share.id,
          filePath: finalFileName,
          originalName: filename,
          relativePath,
          size: BigInt(size),
          mimeType: mimeType || "application/octet-stream",
        },
      });
    } else {
      await libs.prisma.share.update({
        where: { id: share.id },
        data: { filePath: finalFileName },
      });
    }
  } catch (error) {
    // The file is stored but not referenced: remove it
    await libs.deleteFromStorage(finalFileName).catch((deleteError) => {
      console.error("[Upload] Failed to remove unreferenced %s:", finalFileName, deleteError);
    });
    throw error;
  }
}

export async function removeTusFiles(tusTempDir: string, uploadId: string): Promise<void> {
  const tusFilePath = path.join(tusTempDir, uploadId);
  for (const file of [tusFilePath, `${tusFilePath}.json`]) {
    await unlink(file).catch((error) => {
      if (error.code !== "ENOENT") console.error("[Upload] Failed to remove %s:", file, error);
    });
  }
}

export interface TusHooksDeps {
  /** Shared TypeScript modules, loaded once by the caller */
  loadLibs: () => Promise<TusLibs>;
  /** Authenticated uploader of the current HTTP request (AsyncLocalStorage in server.js) */
  getRequestContext: () => TusUploadContext | undefined;
  tusTempDir: string;
}

export function createTusHooks({ loadLibs, getRequestContext, tusTempDir }: TusHooksDeps) {
  return {
    // Called when a new upload is created: validate everything we can before any byte is stored
    async onUploadCreate(_req: unknown, upload: TusUpload | undefined) {
      if (!upload) {
        console.error("onUploadCreate: upload object is undefined");
        throw tusError(500, "Internal Server Error: Upload context missing");
      }

      const libs = await loadLibs();
      const context = getRequestContext();
      if (!context) {
        console.error("[Upload] Missing request context in onUploadCreate");
        throw tusError(500, JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }));
      }

      const metadata = upload.metadata || {};

      try {
        await libs.assertFileUploadAllowed(context);

        // With Upload-Defer-Length the size is unknown here: it is checked on finish anyway
        const sizeKnown = upload.size !== undefined && upload.size !== null;
        if (sizeKnown) {
          await assertWithinLimits(libs, context, upload.size as number);
        }

        if (!isBulkSubsequentFile(metadata)) {
          await libs.validateUploadOptions(rawUploadOptions(metadata), context, {
            anonExpiry: "clamp",
          });
        }

        // Persist who uploads with the upload itself: survives restarts and slow uploads
        return {
          metadata: {
            ...metadata,
            [CTX_IP]: context.clientIp,
            [CTX_USER]: context.userId || "",
            [CTX_AUTH]: context.isAuthenticated ? "1" : "0",
          },
        };
      } catch (error) {
        throw toTusError(error, libs.UploadError);
      }
    },

    // Upload complete: create (or extend) the share and move the file to storage
    async onUploadFinish(_req: unknown, upload: TusUpload) {
      const libs = await loadLibs();
      const metadata = upload.metadata || {};
      const context = readUploadContext(metadata) ?? getRequestContext();
      if (!context) {
        console.error(`[Upload] No upload context for ${upload.id}`);
        throw tusError(500, JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }));
      }

      const filename = metadata.filename || "upload";
      const isBulk = metadata.isBulk === "true";
      const bulkShareId = metadata.bulkShareId || "";
      const relativePath = metadata.relativePath || filename;
      const size = upload.size ?? upload.offset ?? 0;
      const tusFilePath = path.join(tusTempDir, upload.id);

      let createdShareId: string | null = null;
      try {
        // The creation check reserves nothing: other shares may have been stored since
        await assertWithinLimits(libs, context, size);

        let share: ShareRecord;
        if (isBulk && bulkShareId) {
          share = await getOwnedBulkShare(libs, bulkShareId, context);
        } else {
          const options = await libs.resolveUploadOptions(rawUploadOptions(metadata), context, {
            anonExpiry: "clamp",
          });
          share = await libs.createFileShareRecord(options, context, { isBulk, size });
          createdShareId = share.id;
        }

        const finalFileName = libs.generateSafeFilename(filename, share.id, { unique: isBulk });
        await libs.moveToStorage(tusFilePath, finalFileName);
        await unlink(`${tusFilePath}.json`).catch((error) => {
          if (error.code !== "ENOENT")
            console.error("[Upload] Failed to remove tus metadata:", error);
        });

        await recordStoredFile(libs, share, finalFileName, {
          filename,
          relativePath,
          size,
          mimeType: metadata.filetype,
        });
        if (createdShareId) void libs.emitShareEvent("share.created", share);

        return {
          headers: {
            "X-Share-Slug": share.slug,
            "X-Share-Id": share.id,
            "X-Share-Expires": share.expiresAt?.toISOString() || "",
            "X-Is-Bulk": isBulk ? "true" : "false",
          },
        };
      } catch (error) {
        if (createdShareId) await libs.rollbackShare(createdShareId);
        // All bytes are already received, so a retry would find the upload complete and the
        // client would report success without a share. Dropping the upload makes the client
        // start a new one instead (and frees the disk for rejected uploads).
        await removeTusFiles(tusTempDir, upload.id);
        throw toTusError(error, libs.UploadError);
      }
    },
  };
}
