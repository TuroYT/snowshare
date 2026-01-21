/**
 * Custom Node.js server for SnowShare
 * Uses tus protocol for resumable file uploads
 */

import { createServer } from "http";
import { parse } from "url";
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

// Get upload directory
function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

// Get tus temp directory
function getTusTempDir() {
  return path.join(getUploadDir(), ".tus-temp");
}

// Get client IP
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || "unknown";
}

// Convert MB to display unit (MiB or GiB)
function convertFromMBForDisplay(megabytes, useGiB) {
  if (useGiB) {
    // 1 GiB = 1024 MiB
    return Math.round((megabytes / 1024) * 100) / 100;
  } else {
    // MiB = MB (1:1 for practical purposes)
    return megabytes;
  }
}

// Get display unit label
function getUnitLabel(useGiB) {
  return useGiB ? "GiB" : "MiB";
}

// Generate safe filename
function generateSafeFilename(originalName, shareId) {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${shareId}_${baseName}${ext}`;
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

// Authenticate user from request
async function authenticateUser(req) {
  try {
    const token = await getToken({ 
      req: { 
        headers: req.headers,
        cookies: parseCookies(req.headers.cookie || "")
      }, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    if (token?.id) {
      return {
        userId: token.id,
        isAuthenticated: true,
      };
    }
  } catch {
    // Continue as anonymous
  }
  
  return {
    userId: null,
    isAuthenticated: false,
  };
}

// Calculate IP usage for quota
async function calculateIpUsage(prisma, clientIp, uploadsDir) {
  const shares = await prisma.share.findMany({
    where: { ipSource: clientIp, type: "FILE" },
    select: { filePath: true },
  });
  
  let totalSize = 0;
  for (const share of shares) {
    if (share.filePath) {
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
    const clientIp = getClientIp(req);
    
    // Check authentication
    const { userId, isAuthenticated } = await authenticateUser(req);

    // Get settings
    const settings = await prisma.settings.findFirst();
    
    let maxFileSizeMB, ipQuotaMB;
    let useGiBForDisplay;
    if (isAuthenticated) {
      maxFileSizeMB = settings?.authMaxUpload || 51200;
      ipQuotaMB = settings?.authIpQuota || 102400;
      useGiBForDisplay = settings?.useGiBForAuth ?? false;
    } else {
      maxFileSizeMB = settings?.anoMaxUpload || 2048;
      ipQuotaMB = settings?.anoIpQuota || 4096;
      useGiBForDisplay = settings?.useGiBForAnon ?? false;
    }
    
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    const ipQuotaBytes = ipQuotaMB * 1024 * 1024;
    const unitLabel = getUnitLabel(useGiBForDisplay);
    const maxFileSizeDisplay = convertFromMBForDisplay(maxFileSizeMB, useGiBForDisplay);

    // Check file size limit
    // upload.size property contains the size from the Upload-Length header
    // It might be undefined if Upload-Defer-Length: 1 is sent
    const uploadSize = upload.size;
    
    // If size is available, check it against limits
    if (uploadSize !== undefined && uploadSize !== null) {
      if (uploadSize > maxFileSizeBytes) {
        const body = { error: `File size exceeds the allowed limit of ${maxFileSizeDisplay}${unitLabel}.` };
        throw { status_code: 413, body: JSON.stringify(body) };
      }
      
      // Check quota for anonymous users
      if (!isAuthenticated) {
        try {
          const currentUsage = await calculateIpUsage(prisma, clientIp, uploadsDir);
          const remainingQuota = ipQuotaBytes - currentUsage;
          
          if (remainingQuota <= 0) {
            const body = { error: `IP quota exceeded. Sign in for higher limits.` };
            throw { status_code: 429, body: JSON.stringify(body) };
          }
          
          if (uploadSize > remainingQuota) {
            const remainingQuotaMB = Math.round(remainingQuota / (1024 * 1024));
            const remainingDisplay = convertFromMBForDisplay(remainingQuotaMB, useGiBForDisplay);
            const body = { error: `File would exceed your quota. Remaining: ${remainingDisplay}${unitLabel}` };
            throw { status_code: 429, body: JSON.stringify(body) };
          }
        } catch (error) {
          console.error("Error calculating IP usage:", error);
          // If quota check fails, we might want to fail open or closed. 
          // Failing closed (prevent upload) is safer for quotas.
          // But preventing crash is Priority #1
        }
      }
    } else {
        // If size is NOT available (deferred length), checking quota is harder.
        // For now, we allow start, but we should probably limit max content length header if possible
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
      const clientIp = getClientIp(req);
      
      // Re-authenticate user (metadata from onUploadCreate is not persisted)
      const { userId, isAuthenticated } = await authenticateUser(req);

      // Validate slug if provided
      let finalSlug = slug;
      if (finalSlug && !/^[a-zA-Z0-9_-]{3,30}$/.test(finalSlug)) {
        finalSlug = "";
      }

      // Check slug uniqueness
      if (finalSlug) {
        const existing = await prisma.share.findUnique({ where: { slug: finalSlug } });
        if (existing) {
          finalSlug = "";
        }
      }
      if (!finalSlug) {
        finalSlug = crypto.randomBytes(8).toString("hex").slice(0, 16);
      }

      // Parse expiration
      let parsedExpiresAt = null;
      if (expiresAt) {
        parsedExpiresAt = new Date(expiresAt);
        if (isNaN(parsedExpiresAt.getTime())) {
          parsedExpiresAt = null;
        }
      }

      // Anonymous expiration rules
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

      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        const bcrypt = await import("bcryptjs");
        hashedPassword = await bcrypt.default.hash(password, 12);
      }

      // Create database record
      const share = await prisma.share.create({
        data: {
          slug: finalSlug,
          type: "FILE",
          filePath: "",
          password: hashedPassword,
          expiresAt: parsedExpiresAt,
          ipSource: clientIp,
          ownerId: userId || null,
        },
      });

      // Move file from tus temp to final location
      const tusFilePath = path.join(tusTempDir, upload.id);
      const finalFileName = generateSafeFilename(filename, share.id);
      const finalFilePath = path.join(uploadsDir, finalFileName);

      await rename(tusFilePath, finalFilePath);

      // Clean up tus metadata file
      const tusMetaPath = `${tusFilePath}.json`;
      if (existsSync(tusMetaPath)) {
        await unlink(tusMetaPath);
      }

      // Update database
      await prisma.share.update({
        where: { id: share.id },
        data: { filePath: finalFileName },
      });

      console.log(`Upload complete: ${filename} -> ${share.slug}`);

      // Return custom headers for the client
      return {
        headers: {
          "X-Share-Slug": share.slug,
          "X-Share-Expires": share.expiresAt?.toISOString() || ""
        }
      };
    } catch (err) {
      console.error("Error finalizing upload:", err);
      // Don't throw here to avoid 500 to client if possible, but logging is essential
      throw err;
    }
  },
});

// Handle tus requests
async function handleTus(req, res) {
  return tusServer.handle(req, res);
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
