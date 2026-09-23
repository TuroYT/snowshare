/**
 * Custom Node.js server for SnowShare
 * Uses tus protocol for resumable file uploads
 */

import { createServer } from "http";
import { parse } from "url";
import { AsyncLocalStorage } from "async_hooks";
import next from "next";
import { Server as TusServer } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { getToken } from "next-auth/jwt";
import cron from "node-cron";
import { resolveClientIp } from "./src/lib/getClientIp.js";

// Upload metadata keys written by the server (they override any client-supplied value)
const CTX_IP = "ss_ip";
const CTX_USER = "ss_user";
const CTX_AUTH = "ss_auth";
const CTX_SIZE_CHECKED = "ss_size_checked";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Create AsyncLocalStorage for request context
const requestContext = new AsyncLocalStorage();

// Get upload directory
function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

// Get tus temp directory
function getTusTempDir() {
  return path.join(getUploadDir(), ".tus-temp");
}

// Get client IP from native Node.js request (same resolution rules as src/lib/getClientIp.ts)
function getClientIpFromHttpReq(req) {
  const header = (name) => {
    const value = req.headers?.[name];
    return Array.isArray(value) ? value.join(",") : value;
  };
  return resolveClientIp({
    forwardedFor: header("x-forwarded-for"),
    realIp: header("x-real-ip"),
    remoteAddress: req.socket?.remoteAddress,
  });
}

// Parse cookies from header string
function parseCookies(cookieHeader) {
  const cookies = {};
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

// Authenticate user from HTTP request (supports NextAuth JWT + API key Bearer token)
async function authenticateFromRequest(req) {
  // 1. Try API key Bearer token
  const authHeader = req.headers?.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    if (rawKey.startsWith("sk_")) {
      try {
        const { prisma } = await import("./src/lib/prisma.js");
        const { hashApiKey } = await import("./src/lib/security.js");
        const keyHash = hashApiKey(rawKey);
        const apiKey = await prisma.apiKey.findUnique({
          where: { keyHash },
          select: { id: true, userId: true, expiresAt: true },
        });
        if (apiKey && (!apiKey.expiresAt || apiKey.expiresAt > new Date())) {
          // Fire-and-forget lastUsedAt update
          prisma.apiKey
            .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
            .catch((err) => console.warn("[Auth] Failed to update lastUsedAt:", err.message));
          return { userId: apiKey.userId, isAuthenticated: true };
        }
      } catch (error) {
        console.error("[Auth] API key lookup error:", error.message);
      }
    }
  }

  // 2. NextAuth JWT session
  try {
    const cookies = parseCookies(req.headers?.cookie || "");
    const token = await getToken({
      req: {
        headers: req.headers || {},
        cookies,
      },
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (token?.id) {
      return {
        userId: token.id,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    console.error("[Auth] Error:", error.message);
  }

  return {
    userId: null,
    isAuthenticated: false,
  };
}

// Shared TypeScript modules, loaded once (tsx resolves the .js paths to the .ts sources)
let libsPromise;
function loadLibs() {
  libsPromise ??= Promise.all([
    import("./src/lib/prisma.js"),
    import("./src/lib/upload-share.js"),
    import("./src/lib/quota-shared.js"),
    import("./src/lib/files.js"),
    import("./src/lib/storage.js"),
  ]).then(([prismaLib, uploadShare, quota, files, storage]) => ({
    prisma: prismaLib.prisma,
    ...uploadShare,
    ...quota,
    ...files,
    ...storage,
  }));
  return libsPromise;
}

/** Converts an error to the { status_code, body } shape tus-node-server returns to clients. */
function toTusError(error, UploadError) {
  if (error && typeof error === "object" && "status_code" in error) return error;
  if (UploadError && error instanceof UploadError) {
    return { status_code: error.status, body: JSON.stringify({ error: error.code }) };
  }
  console.error("[Upload] Unexpected error:", error);
  return { status_code: 500, body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }) };
}

/** Upload context persisted in the upload metadata at creation (survives restarts). */
function readUploadContext(metadata) {
  if (metadata?.[CTX_AUTH] === undefined) return null;
  return {
    clientIp: metadata[CTX_IP],
    userId: metadata[CTX_USER] || null,
    isAuthenticated: metadata[CTX_AUTH] === "1",
  };
}

/**
 * Enforces the per-file size limit and the IP quota for an upload of `size` bytes.
 * Fails closed: if usage cannot be computed, the upload is refused.
 */
async function assertWithinLimits(libs, context, size) {
  let limits;
  try {
    limits = await libs.getUploadLimits(context.clientIp, context.isAuthenticated);
  } catch (error) {
    console.error("[Upload] Cannot compute upload limits, refusing upload:", error);
    throw { status_code: 503, body: JSON.stringify({ error: "QUOTA_UNAVAILABLE" }) };
  }
  if (size > limits.maxFileSizeBytes) {
    throw { status_code: 413, body: JSON.stringify({ error: "FILE_TOO_LARGE" }) };
  }
  if (size > limits.remainingQuotaBytes) {
    throw { status_code: 429, body: JSON.stringify({ error: "IP_QUOTA_EXCEEDED" }) };
  }
}

function isBulkSubsequentFile(metadata) {
  return (
    metadata.isBulk === "true" &&
    (!!metadata.bulkShareId || (!!metadata.fileIndex && parseInt(metadata.fileIndex, 10) > 0))
  );
}

function rawUploadOptions(metadata) {
  return {
    slug: metadata.slug,
    password: metadata.password,
    expiresAt: metadata.expiresAt,
    maxViews: metadata.maxViews,
    note: metadata.note,
  };
}

/** Returns the existing bulk share for a subsequent file, after checking the uploader owns it. */
async function getOwnedBulkShare(libs, bulkShareId, context) {
  const share = await libs.prisma.share.findUnique({ where: { id: bulkShareId } });
  if (!share || !share.isBulk) {
    console.error(`[Upload] Bulk share not found: ${bulkShareId}`);
    throw { status_code: 404, body: JSON.stringify({ error: "SHARE_NOT_FOUND" }) };
  }
  const ownsShare = context.isAuthenticated
    ? share.ownerId === context.userId
    : share.ipSource === context.clientIp;
  if (!ownsShare) {
    console.error(
      `[Upload] Unauthorized bulk share access: ${bulkShareId} by ${context.isAuthenticated ? `user ${context.userId}` : `IP ${context.clientIp}`}`
    );
    throw { status_code: 403, body: JSON.stringify({ error: "UNAUTHORIZED_SHARE_ACCESS" }) };
  }
  return share;
}

async function removeTusFiles(uploadId) {
  const tusFilePath = path.join(tusTempDir, uploadId);
  for (const file of [tusFilePath, `${tusFilePath}.json`]) {
    await unlink(file).catch((error) => {
      if (error.code !== "ENOENT") console.error(`[Upload] Failed to remove ${file}:`, error);
    });
  }
}

// Ensure directories exist
const uploadsDir = getUploadDir();
const tusTempDir = getTusTempDir();

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}
if (!existsSync(tusTempDir)) {
  mkdirSync(tusTempDir, { recursive: true });
}

// Create tus server with FileStore
const tusServer = new TusServer({
  path: "/api/tus",
  datastore: new FileStore({ directory: tusTempDir }),
  // Max file size (will be checked per-user in onUploadCreate)
  maxSize: 1024 * 1024 * 1024 * 1024, // 1TB absolute max
  // Expose custom headers to client
  respectForwardedHeaders: true,
  generateUrl(req, { proto: _proto, host: _host, path, id }) {
    // Use relative URL to avoid protocol mismatch behind reverse proxies (CSP 'self')
    return `${path}/${id}`;
  },

  // Called when a new upload is created: validate everything we can before any byte is stored
  async onUploadCreate(req, upload) {
    if (!upload) {
      console.error("onUploadCreate: upload object is undefined");
      throw { status_code: 500, body: "Internal Server Error: Upload context missing" };
    }

    const libs = await loadLibs();
    const context = requestContext.getStore();
    if (!context) {
      console.error("[Upload] Missing request context in onUploadCreate");
      throw { status_code: 500, body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }) };
    }

    const metadata = upload.metadata || {};

    try {
      await libs.assertFileUploadAllowed(context);

      // With Upload-Defer-Length the size is unknown here: limits are enforced on finish
      const sizeKnown = upload.size !== undefined && upload.size !== null;
      if (sizeKnown) {
        await assertWithinLimits(libs, context, upload.size);
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
          [CTX_SIZE_CHECKED]: sizeKnown ? "1" : "0",
        },
      };
    } catch (error) {
      throw toTusError(error, libs.UploadError);
    }
  },

  // Called when upload is complete: create (or extend) the share and move the file to storage
  async onUploadFinish(req, upload) {
    const libs = await loadLibs();
    const metadata = upload.metadata || {};
    const context = readUploadContext(metadata) ?? requestContext.getStore();
    if (!context) {
      console.error(`[Upload] No upload context for ${upload.id}`);
      throw { status_code: 500, body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }) };
    }

    const filename = metadata.filename || "upload";
    const isBulk = metadata.isBulk === "true";
    const bulkShareId = metadata.bulkShareId || "";
    const relativePath = metadata.relativePath || filename;
    const fileIndex = metadata.fileIndex ? parseInt(metadata.fileIndex, 10) : 0;
    const totalFiles = metadata.totalFiles ? parseInt(metadata.totalFiles, 10) : 1;
    const size = upload.size ?? upload.offset ?? 0;
    const tusFilePath = path.join(tusTempDir, upload.id);

    let createdShareId = null;
    try {
      if (metadata[CTX_SIZE_CHECKED] !== "1") {
        await assertWithinLimits(libs, context, size);
      }

      let share;
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

      try {
        if (share.isBulk) {
          await libs.prisma.shareFile.create({
            data: {
              shareId: share.id,
              filePath: finalFileName,
              originalName: filename,
              relativePath,
              size: BigInt(size),
              mimeType: metadata.filetype || "application/octet-stream",
            },
          });
          console.log(
            `Bulk upload file ${fileIndex + 1}/${totalFiles}: ${filename} -> ${share.slug}`
          );
        } else {
          await libs.prisma.share.update({
            where: { id: share.id },
            data: { filePath: finalFileName },
          });
          console.log(`Upload complete: ${filename} -> ${share.slug}`);
        }
      } catch (error) {
        // The file is stored but not referenced: remove it
        await libs.deleteFromStorage(finalFileName).catch((deleteError) => {
          console.error(`[Upload] Failed to remove unreferenced ${finalFileName}:`, deleteError);
        });
        throw error;
      }

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
      // A rejected upload (limits, validation) will never be finalized: free the disk now
      if (
        error &&
        typeof error === "object" &&
        ("status_code" in error || error instanceof libs.UploadError)
      ) {
        await removeTusFiles(upload.id);
      }
      throw toTusError(error, libs.UploadError);
    }
  },
});

// Handle tus requests
async function handleTus(req, res) {
  const clientIp = getClientIpFromHttpReq(req);
  const { userId, isAuthenticated } = await authenticateFromRequest(req);

  const context = {
    clientIp,
    userId,
    isAuthenticated,
    timestamp: Date.now(),
  };

  return requestContext.run(context, () => {
    return tusServer.handle(req, res);
  });
}

// Full cleanup (expired shares, abandoned tus uploads, orphan files), never overlapping runs
let cleanupRunning = false;
async function runScheduledCleanup(runCleanup) {
  if (cleanupRunning) {
    console.warn("[Cleanup] Previous run still in progress, skipping");
    return;
  }
  cleanupRunning = true;
  try {
    await runCleanup();
  } catch (error) {
    console.error("[Cleanup] Error during scheduled cleanup:", error);
  } finally {
    cleanupRunning = false;
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled promise rejection:", reason);
});

app
  .prepare()
  .then(async () => {
    const { runCleanup } = await import("./scripts/cleanup-expired-shares.ts");
    const cleanupTask = cron.schedule("0 * * * *", () => runScheduledCleanup(runCleanup));
    console.log("> Scheduled hourly cleanup (expired shares, abandoned uploads, orphan files)");

    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        const { pathname } = parsedUrl;

        // Handle tus uploads
        if (pathname.startsWith("/api/tus")) {
          await handleTus(req, res);
          return;
        }

        // Let Next.js handle everything else
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Server error:", err);
        res.statusCode = 500;
        res.end("Internal server error");
      }
    });

    // Large single-request uploads (non-tus) can legitimately take longer than Node's
    // default 5-minute request timeout; idle sockets are still closed by keepAliveTimeout
    server.requestTimeout = 0;

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(
        `> Tus upload endpoint: http://${hostname}:${port}/api/tus (resumable uploads enabled)`
      );
    });

    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`> ${signal} received, shutting down gracefully`);
      cleanupTask.stop();
      const forceExit = setTimeout(() => process.exit(1), 10_000);
      forceExit.unref();
      server.close(async () => {
        try {
          const { prisma } = await import("./src/lib/prisma.js");
          await prisma.$disconnect();
        } catch (error) {
          console.error("> Error while disconnecting Prisma:", error);
        }
        process.exit(0);
      });
      server.closeIdleConnections?.();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    console.error("> Failed to start server:", error);
    process.exit(1);
  });
