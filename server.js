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
import { stat, rename, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getToken } from "next-auth/jwt";
import cron from "node-cron";

// Security constants (mirrored from src/lib/security.ts for use in plain JS server)
const BCRYPT_COST = 12;
const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_ANON_EXPIRY_DAYS = 7;

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

// Get client IP from native Node.js request
function getClientIpFromHttpReq(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }

  // Try x-real-ip header
  const realIp = req.headers?.["x-real-ip"];
  if (realIp) {
    return realIp;
  }

  // Try socket.remoteAddress
  const socketAddress = req.socket?.remoteAddress;
  if (socketAddress) {
    // Normalize IPv6 localhost and IPv4-mapped addresses
    if (socketAddress === "::1" || socketAddress === "::ffff:127.0.0.1") {
      return "127.0.0.1";
    }
    return socketAddress;
  }

  // Try connection.remoteAddress (older Node.js versions)
  const connectionAddress = req.connection?.remoteAddress;
  if (connectionAddress) {
    if (connectionAddress === "::1" || connectionAddress === "::ffff:127.0.0.1") {
      return "127.0.0.1";
    }
    return connectionAddress;
  }

  return "127.0.0.1";
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

// Generate safe filename — delegates to src/lib/files.ts at runtime
async function generateSafeFilename(originalName, shareId) {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${shareId}_${baseName}${ext}`;
}

// Calculate IP usage for quota (single + bulk uploads)
async function calculateIpUsage(prisma, clientIp, uploadsDir) {
  const shares = await prisma.share.findMany({
    where: { ipSource: clientIp, type: "FILE" },
    select: {
      filePath: true,
      isBulk: true,
      files: { select: { size: true } },
    },
  });

  let totalSize = 0;
  const storageModule = await import("./src/lib/storage.js");

  for (const share of shares) {
    if (share.isBulk && share.files?.length > 0) {
      for (const file of share.files) {
        totalSize += Number(file.size);
      }
    } else if (share.filePath) {
      try {
        totalSize += await storageModule.getStorageFileSize(share.filePath);
      } catch {
        // File missing — skip
      }
    }
  }
  return totalSize;
}

function resolveUploadLimits(settings, isAuthenticated) {
  const maxFileSizeMB = isAuthenticated
    ? settings?.authMaxUpload || 51200
    : settings?.anoMaxUpload || 2048;
  const ipQuotaMB = isAuthenticated
    ? settings?.authIpQuota || 102400
    : settings?.anoIpQuota || 4096;
  return {
    maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    ipQuotaBytes: ipQuotaMB * 1024 * 1024,
  };
}

function parseAndClampExpiresAt(expiresAt, isAuthenticated) {
  let parsed = null;
  if (expiresAt) {
    parsed = new Date(expiresAt);
    if (isNaN(parsed.getTime())) parsed = null;
  }
  if (!isAuthenticated) {
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + MAX_ANON_EXPIRY_DAYS);
    if (!parsed) return maxExpiry;
    if (parsed > maxExpiry) return maxExpiry;
  }
  return parsed;
}

async function hashUploadPassword(password) {
  if (!password) return null;
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(password, BCRYPT_COST);
}

async function checkUploadQuota(prisma, clientIp, uploadSize, maxFileSizeBytes, ipQuotaBytes) {
  if (uploadSize === undefined || uploadSize === null) return;
  if (uploadSize > maxFileSizeBytes) {
    throw { status_code: 413, body: JSON.stringify({ error: "FILE_TOO_LARGE" }) };
  }
  let currentUsage = 0;
  try {
    currentUsage = await calculateIpUsage(prisma, clientIp, getUploadDir());
  } catch (error) {
    console.error("Error calculating IP usage:", error);
  }
  const remaining = ipQuotaBytes - currentUsage;
  if (remaining <= 0 || uploadSize > remaining) {
    throw { status_code: 429, body: JSON.stringify({ error: "IP_QUOTA_EXCEEDED" }) };
  }
}

async function validateUploadSlug(prisma, slug, isBulkSubsequent) {
  if (!slug) return;
  if (!SLUG_REGEX.test(slug)) {
    throw { status_code: 400, body: JSON.stringify({ error: "SLUG_INVALID" }) };
  }
  if (!isBulkSubsequent) {
    const existing = await prisma.share.findUnique({ where: { slug } });
    if (existing) throw { status_code: 409, body: JSON.stringify({ error: "SLUG_ALREADY_TAKEN" }) };
  }
}

async function resolveUploadShare(
  prisma,
  { isBulk, bulkShareId, fileIndex, slug, password, expiresAt, maxViews },
  { clientIp, userId, isAuthenticated }
) {
  if (isBulk && bulkShareId) {
    const share = await prisma.share.findUnique({ where: { id: bulkShareId } });
    if (!share) {
      console.error(`[Upload] Bulk share not found: ${bulkShareId}`);
      throw new Error("Bulk share not found");
    }
    const ownsShare = isAuthenticated ? share.ownerId === userId : share.ipSource === clientIp;
    if (!ownsShare) {
      console.error(
        `[Upload] Unauthorized bulk share access: ${bulkShareId} by ${isAuthenticated ? `user ${userId}` : `IP ${clientIp}`}`
      );
      throw { status_code: 403, body: JSON.stringify({ error: "UNAUTHORIZED_SHARE_ACCESS" }) };
    }
    return share;
  }

  const finalSlug = await resolveSlugOrGenerate(prisma, slug);
  const parsedExpiresAt = parseAndClampExpiresAt(expiresAt, isAuthenticated);
  const hashedPassword = await hashUploadPassword(password);

  if (isBulk && fileIndex === 0) {
    const share = await prisma.share.create({
      data: {
        slug: finalSlug,
        type: "FILE",
        password: hashedPassword,
        expiresAt: parsedExpiresAt,
        ipSource: clientIp,
        ownerId: userId || null,
        isBulk: true,
        maxViews,
      },
    });
    console.log(`Created bulk share: ${share.slug}`);
    return share;
  }

  return prisma.share.create({
    data: {
      slug: finalSlug,
      type: "FILE",
      filePath: "",
      password: hashedPassword,
      expiresAt: parsedExpiresAt,
      ipSource: clientIp,
      ownerId: userId || null,
      isBulk: false,
      maxViews,
    },
  });
}

async function finalizeUploadFile(
  prisma,
  upload,
  share,
  { filename, relativePath, fileIndex, totalFiles, filetype },
  s3Active
) {
  const tusFilePath = path.join(tusTempDir, upload.id);
  const finalFileName = await generateSafeFilename(filename, share.id);
  const finalFilePath = path.join(uploadsDir, finalFileName);
  const tusMetaPath = `${tusFilePath}.json`;

  if (s3Active) {
    const { uploadToStorage } = await import("./src/lib/storage.js");
    await uploadToStorage(tusFilePath, finalFileName);
    await unlink(tusFilePath);
  } else {
    await rename(tusFilePath, finalFilePath);
  }
  if (existsSync(tusMetaPath)) await unlink(tusMetaPath);

  if (share.isBulk) {
    const fileStats = s3Active ? { size: upload.size ?? 0 } : await stat(finalFilePath);
    const currentShare = await prisma.share.findUnique({
      where: { id: share.id },
      select: { id: true, slug: true },
    });
    if (!currentShare) {
      if (!s3Active) await unlink(finalFilePath).catch(() => {});
      throw new Error("Bulk share no longer exists");
    }
    try {
      await prisma.shareFile.create({
        data: {
          shareId: share.id,
          filePath: finalFileName,
          originalName: filename,
          relativePath,
          size: BigInt(fileStats.size),
          mimeType: filetype || "application/octet-stream",
        },
      });
      console.log(`Bulk upload file ${fileIndex + 1}/${totalFiles}: ${filename} -> ${share.slug}`);
    } catch (error) {
      if (!s3Active) await unlink(finalFilePath).catch(() => {});
      if (error?.code === "P2003") {
        console.error(`[Upload] FK constraint when linking bulk file to share ${share.id}:`, error);
        throw new Error("Bulk share reference missing during file finalize");
      }
      throw error;
    }
  } else {
    await prisma.share.update({ where: { id: share.id }, data: { filePath: finalFileName } });
    console.log(`Upload complete: ${filename} -> ${share.slug}`);
  }

  return finalFileName;
}

async function resolveSlugOrGenerate(prisma, slug) {
  let finalSlug = slug;
  if (finalSlug && !SLUG_REGEX.test(finalSlug)) {
    throw { status_code: 400, body: JSON.stringify({ error: "SLUG_INVALID" }) };
  }
  if (finalSlug) {
    const existing = await prisma.share.findUnique({ where: { slug: finalSlug } });
    if (existing) throw { status_code: 409, body: JSON.stringify({ error: "SLUG_ALREADY_TAKEN" }) };
  }
  if (!finalSlug) {
    finalSlug = crypto.randomBytes(8).toString("hex").slice(0, 16);
  }
  return finalSlug;
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

// Store upload metadata indexed by upload ID (with TTL cleanup to prevent memory leaks)
const uploadMetadata = new Map();
const UPLOAD_METADATA_TTL_MS = 60 * 60 * 1000; // 1 hour

// Periodically clean up stale upload metadata entries
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of uploadMetadata.entries()) {
      if (now - value.timestamp > UPLOAD_METADATA_TTL_MS) {
        uploadMetadata.delete(key);
      }
    }
  },
  10 * 60 * 1000
); // Run every 10 minutes

// Create tus server with FileStore
const tusServer = new TusServer({
  path: "/api/tus",
  datastore: new FileStore({ directory: tusTempDir }),
  // Max file size (will be checked per-user in onUploadCreate)
  maxSize: 1024 * 1024 * 1024 * 1024, // 1TB absolute max
  // Expose custom headers to client
  respectForwardedHeaders: true,
  generateUrl(req, { proto, host, path, id }) {
    // Use relative URL to avoid protocol mismatch behind reverse proxies (CSP 'self')
    return `${path}/${id}`;
  },

  // Called when a new upload is created
  async onUploadCreate(req, upload) {
    if (!upload) {
      console.error("onUploadCreate: upload object is undefined");
      throw { status_code: 500, body: "Internal Server Error: Upload context missing" };
    }

    const { prisma } = await import("./src/lib/prisma.js");

    const uploadId = upload.id;
    let clientIp, userId, isAuthenticated;

    // Try to get metadata from AsyncLocalStorage context
    const store = requestContext.getStore();

    if (store) {
      ({ clientIp, userId, isAuthenticated } = store);
    } else {
      // Fallback if context is missing (should not happen if wrapped correctly)
      console.warn("[Upload] Warning: Missing async context, falling back to request inspection");
      clientIp = getClientIpFromHttpReq(req);
      const auth = await authenticateFromRequest(req);
      userId = auth.userId;
      isAuthenticated = auth.isAuthenticated;
    }

    // Store metadata for onUploadFinish (timestamp for TTL cleanup)
    uploadMetadata.set(uploadId, {
      clientIp,
      userId,
      isAuthenticated,
      timestamp: Date.now(),
    });

    const settings = await prisma.settings.findFirst();
    const { maxFileSizeBytes, ipQuotaBytes } = resolveUploadLimits(settings, isAuthenticated);
    await checkUploadQuota(prisma, clientIp, upload.size, maxFileSizeBytes, ipQuotaBytes);

    const metadata = upload.metadata || {};
    const slug = metadata.slug?.trim();
    const isBulkSubsequent =
      metadata.isBulk === "true" &&
      (metadata.bulkShareId || (metadata.fileIndex && parseInt(metadata.fileIndex) > 0));
    await validateUploadSlug(prisma, slug, isBulkSubsequent);

    return { res: null };
  },

  // Called when upload is complete
  async onUploadFinish(req, upload) {
    const { prisma } = await import("./src/lib/prisma.js");

    try {
      const metadata = upload.metadata || {};
      const filename = metadata.filename || "upload";
      const slug = metadata.slug || "";
      const password = metadata.password || "";
      const expiresAt = metadata.expiresAt || "";
      const maxViewsRaw = metadata.maxViews ? parseInt(metadata.maxViews) : null;
      const maxViews = maxViewsRaw && maxViewsRaw > 0 ? maxViewsRaw : null;
      const isBulk = metadata.isBulk === "true";
      const bulkShareId = metadata.bulkShareId || "";
      const relativePath = metadata.relativePath || filename;
      const fileIndex = metadata.fileIndex ? parseInt(metadata.fileIndex) : 0;
      const totalFiles = metadata.totalFiles ? parseInt(metadata.totalFiles) : 1;

      // Get metadata by upload ID
      const uploadId = upload.id;
      const storedMetadata = uploadMetadata.get(uploadId);

      if (!storedMetadata) {
        console.error(`[Upload] No metadata found for upload ${uploadId}`);
        throw new Error("Missing upload metadata");
      }

      const { clientIp, userId, isAuthenticated } = storedMetadata;

      // Clean up
      uploadMetadata.delete(uploadId);

      const share = await resolveUploadShare(
        prisma,
        { isBulk, bulkShareId, fileIndex, slug, password, expiresAt, maxViews },
        { clientIp, userId, isAuthenticated }
      );

      const { isS3Enabled } = await import("./src/lib/storage.js");
      const s3Active = await isS3Enabled();

      await finalizeUploadFile(
        prisma,
        upload,
        share,
        { filename, relativePath, fileIndex, totalFiles, filetype: metadata.filetype },
        s3Active
      );

      return {
        headers: {
          "X-Share-Slug": share.slug,
          "X-Share-Id": share.id,
          "X-Share-Expires": share.expiresAt?.toISOString() || "",
          "X-Is-Bulk": isBulk ? "true" : "false",
        },
      };
    } catch (err) {
      console.error("Error finalizing upload:", err);
      throw err;
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

app.prepare().then(async () => {
  // Schedule hourly cleanup of expired shares (replaces crond)
  const { default: cleanupExpiredShares } = await import("./scripts/cleanup-expired-shares.ts");
  cron.schedule("0 * * * *", () => {
    cleanupExpiredShares().catch((err) =>
      console.error("[Cleanup] Error during scheduled cleanup:", err)
    );
  });
  console.log("> Scheduled hourly cleanup of expired shares");

  createServer(async (req, res) => {
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
  }).listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(
      `> Tus upload endpoint: http://${hostname}:${port}/api/tus (resumable uploads enabled)`
    );
  });
});
