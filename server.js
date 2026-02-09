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

// Authenticate user from HTTP request
async function authenticateFromRequest(req) {
  try {
    const cookies = parseCookies(req.headers?.cookie || "");
    const token = await getToken({ 
      req: { 
        headers: req.headers || {},
        cookies
      }, 
      secret: process.env.NEXTAUTH_SECRET 
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

// Generate safe filename
function generateSafeFilename(originalName, shareId) {
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
  for (const share of shares) {
    if (share.isBulk && share.files?.length > 0) {
      // Bulk upload: sum ShareFile sizes
      for (const file of share.files) {
        totalSize += Number(file.size);
      }
    } else if (share.filePath) {
      // Single upload: stat file on disk
      const fullPath = path.join(uploadsDir, share.filePath);
      try {
        const stats = await stat(fullPath);
        totalSize += stats.size;
      } catch {
        // File doesn't exist, skip
      }
    }
  }
  return totalSize;
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

// Store upload metadata indexed by upload ID
const uploadMetadata = new Map();

// Create tus server with FileStore
const tusServer = new TusServer({
  path: "/api/tus",
  datastore: new FileStore({ directory: tusTempDir }),
  // Max file size (will be checked per-user in onUploadCreate)
  maxSize: 1024 * 1024 * 1024 * 1024, // 1TB absolute max
  // Expose custom headers to client
  respectForwardedHeaders: true,
  generateUrl(req, { proto, host, path, id }) {
    // Return the URL without query strings to fix potential parsing issues
    return `${proto}://${host}${path}/${id}`;
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
    
    // Store metadata for onUploadFinish
    uploadMetadata.set(uploadId, {
      clientIp,
      userId,
      isAuthenticated
    });

    // Get settings
    const settings = await prisma.settings.findFirst();
    
    let maxFileSizeMB, ipQuotaMB;
    if (isAuthenticated) {
      maxFileSizeMB = settings?.authMaxUpload || 51200;
      ipQuotaMB = settings?.authIpQuota || 102400;
    } else {
      maxFileSizeMB = settings?.anoMaxUpload || 2048;
      ipQuotaMB = settings?.anoIpQuota || 4096;
    }

    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    const ipQuotaBytes = ipQuotaMB * 1024 * 1024;

    // Check file size limit
    // upload.size property contains the size from the Upload-Length header
    // It might be undefined if Upload-Defer-Length: 1 is sent
    const uploadSize = upload.size;
    
    // If size is available, check it against limits
    if (uploadSize !== undefined && uploadSize !== null) {
      if (uploadSize > maxFileSizeBytes) {
        const body = { error: "FILE_TOO_LARGE" };
        throw { status_code: 413, body: JSON.stringify(body) };
      }

      // Check IP quota
      let currentUsage;
      try {
        currentUsage = await calculateIpUsage(prisma, clientIp, uploadsDir);
      } catch (error) {
        console.error("Error calculating IP usage:", error);
        currentUsage = 0;
      }

      const remainingQuota = ipQuotaBytes - currentUsage;

      if (remainingQuota <= 0 || uploadSize > remainingQuota) {
        const body = { error: "IP_QUOTA_EXCEEDED" };
        throw { status_code: 429, body: JSON.stringify(body) };
      }
    } else {
        // If size is NOT available (deferred length), checking quota is harder.
        // For now, we allow start, but we should probably limit max content length header if possible
    }

    // Validate slug before upload starts
    const metadata = upload.metadata || {};
    const slug = metadata.slug?.trim();
    if (slug) {
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
        const body = { error: "SLUG_INVALID" };
        throw { status_code: 400, body: JSON.stringify(body) };
      }
      const existingShare = await prisma.share.findUnique({ where: { slug } });
      if (existingShare) {
        const body = { error: "SLUG_ALREADY_TAKEN" };
        throw { status_code: 409, body: JSON.stringify(body) };
      }
    }

    // metadata is provided by the client and persisted by tus
    // Server-side metadata additions here are NOT persisted
    // Authentication must be re-done in onUploadFinish
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

      let share;
      
      if (isBulk && bulkShareId) {
        share = await prisma.share.findUnique({ where: { id: bulkShareId } });
        
        if (!share) {
          console.error(`[Upload] Bulk share not found: ${bulkShareId}`);
          throw new Error("Bulk share not found");
        }
      } else if (isBulk && fileIndex === 0) {
        let finalSlug = slug;
        if (finalSlug && !/^[a-zA-Z0-9_-]{3,30}$/.test(finalSlug)) {
          const body = { error: "SLUG_INVALID" };
          throw { status_code: 400, body: JSON.stringify(body) };
        }

        if (finalSlug) {
          const existing = await prisma.share.findUnique({ where: { slug: finalSlug } });
          if (existing) {
            const body = { error: "SLUG_ALREADY_TAKEN" };
            throw { status_code: 409, body: JSON.stringify(body) };
          }
        }
        if (!finalSlug) {
          finalSlug = crypto.randomBytes(8).toString("hex").slice(0, 16);
        }

        let parsedExpiresAt = null;
        if (expiresAt) {
          parsedExpiresAt = new Date(expiresAt);
          if (isNaN(parsedExpiresAt.getTime())) {
            parsedExpiresAt = null;
          }
        }

        if (!isAuthenticated) {
          const defaultExpiry = new Date();
          defaultExpiry.setDate(defaultExpiry.getDate() + 7);
          
          if (!parsedExpiresAt) {
            parsedExpiresAt = defaultExpiry;
          } else {
            const maxExpiry = new Date();
            maxExpiry.setDate(maxExpiry.getDate() + 7);
            if (parsedExpiresAt > maxExpiry) {
              parsedExpiresAt = maxExpiry;
            }
          }
        }

        let hashedPassword = null;
        if (password) {
          const bcrypt = await import("bcryptjs");
          hashedPassword = await bcrypt.default.hash(password, 12);
        }

        share = await prisma.share.create({
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
      } else {
        let finalSlug = slug;
        if (finalSlug && !/^[a-zA-Z0-9_-]{3,30}$/.test(finalSlug)) {
          const body = { error: "SLUG_INVALID" };
          throw { status_code: 400, body: JSON.stringify(body) };
        }

        if (finalSlug) {
          const existing = await prisma.share.findUnique({ where: { slug: finalSlug } });
          if (existing) {
            const body = { error: "SLUG_ALREADY_TAKEN" };
            throw { status_code: 409, body: JSON.stringify(body) };
          }
        }
        if (!finalSlug) {
          finalSlug = crypto.randomBytes(8).toString("hex").slice(0, 16);
        }

        let parsedExpiresAt = null;
        if (expiresAt) {
          parsedExpiresAt = new Date(expiresAt);
          if (isNaN(parsedExpiresAt.getTime())) {
            parsedExpiresAt = null;
          }
        }

        if (!isAuthenticated) {
          const defaultExpiry = new Date();
          defaultExpiry.setDate(defaultExpiry.getDate() + 7);
          
          if (!parsedExpiresAt) {
            parsedExpiresAt = defaultExpiry;
          } else {
            const maxExpiry = new Date();
            maxExpiry.setDate(maxExpiry.getDate() + 7);
            if (parsedExpiresAt > maxExpiry) {
              parsedExpiresAt = maxExpiry;
            }
          }
        }

        let hashedPassword = null;
        if (password) {
          const bcrypt = await import("bcryptjs");
          hashedPassword = await bcrypt.default.hash(password, 12);
        }

        share = await prisma.share.create({
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

      const tusFilePath = path.join(tusTempDir, upload.id);
      const finalFileName = generateSafeFilename(filename, share.id);
      const finalFilePath = path.join(uploadsDir, finalFileName);

      await rename(tusFilePath, finalFilePath);

      const tusMetaPath = `${tusFilePath}.json`;
      if (existsSync(tusMetaPath)) {
        await unlink(tusMetaPath);
      }

      if (isBulk) {
        const fileStats = await stat(finalFilePath);
        // Re-validate the bulk share exists to avoid FK errors if it was removed between checks
        const currentShare = await prisma.share.findUnique({ where: { id: share.id }, select: { id: true, slug: true } });

        if (!currentShare) {
          console.error(`[Upload] Bulk share disappeared before linking file: ${share.id}`);
          await unlink(finalFilePath).catch(() => {});
          throw new Error("Bulk share no longer exists");
        }
        
        try {
          await prisma.shareFile.create({
            data: {
              shareId: share.id,
              filePath: finalFileName,
              originalName: filename,
              relativePath: relativePath,
              size: BigInt(fileStats.size),
              mimeType: metadata.filetype || "application/octet-stream",
            },
          });
          
          console.log(`Bulk upload file ${fileIndex + 1}/${totalFiles}: ${filename} -> ${share.slug}`);
        } catch (error) {
          // Clean up the file if we fail to persist the DB relation to avoid orphaned disk usage
          await unlink(finalFilePath).catch(() => {});
          if (error?.code === "P2003") {
            console.error(`[Upload] FK constraint when linking bulk file to share ${share.id}:`, error);
            throw new Error("Bulk share reference missing during file finalize");
          }
          throw error;
        }
      } else {
        await prisma.share.update({
          where: { id: share.id },
          data: { filePath: finalFileName },
        });
        
        console.log(`Upload complete: ${filename} -> ${share.slug}`);
      }

      return {
        headers: {
          "X-Share-Slug": share.slug,
          "X-Share-Id": share.id,
          "X-Share-Expires": share.expiresAt?.toISOString() || "",
          "X-Is-Bulk": isBulk ? "true" : "false",
        }
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
    timestamp: Date.now()
  };
  
  return requestContext.run(context, () => {
    return tusServer.handle(req, res);
  });
}

app.prepare().then(() => {
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
    console.log(`> Tus upload endpoint: http://${hostname}:${port}/api/tus (resumable uploads enabled)`);
  });
});
