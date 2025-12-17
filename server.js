/**
 * Custom Node.js server for SnowShare
 * Handles file uploads OUTSIDE of Next.js to avoid body buffering
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import Busboy from "busboy";
import { createWriteStream, existsSync, unlinkSync, mkdirSync } from "fs";
import { stat, rename } from "fs/promises";
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

// Handle file upload - streams directly to disk without buffering
async function handleUpload(req, res) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Content-Type must be multipart/form-data" }));
    return;
  }

  const uploadsDir = getUploadDir();
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const clientIp = getClientIp(req);

  // Dynamic imports for Prisma and bcrypt (ESM modules)
  const { PrismaClient } = await import("./src/generated/prisma/index.js");
  const prisma = new PrismaClient();
  
  try {
    // Check authentication via JWT token
    let userId = null;
    let isAuthenticated = false;
    
    try {
      // Create a minimal request-like object for getToken
      const token = await getToken({ 
        req: { 
          headers: req.headers,
          cookies: parseCookies(req.headers.cookie || "")
        }, 
        secret: process.env.NEXTAUTH_SECRET 
      });
      
      if (token?.id) {
        userId = token.id;
        isAuthenticated = true;
      }
    } catch (authErr) {
      // Auth check failed, continue as anonymous
      console.log("Auth check failed, treating as anonymous:", authErr);
    }

    // Get settings for limits
    const settings = await prisma.settings.findFirst();
    
    // Authenticated users have NO limits (or very high limits)
    // Anonymous users have restricted limits
    let maxFileSizeMB, ipQuotaMB;
    
    if (isAuthenticated) {
      // Authenticated users: use auth limits (essentially no practical limit)
      maxFileSizeMB = settings?.authMaxUpload || 51200; // ~50GB
      ipQuotaMB = settings?.authIpQuota || 102400; // ~100GB
    } else {
      // Anonymous users: restricted limits
      maxFileSizeMB = settings?.anoMaxUpload || 2048;
      ipQuotaMB = settings?.anoIpQuota || 4096;
    }
    
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    const ipQuotaBytes = ipQuotaMB * 1024 * 1024;

    // For authenticated users, skip quota check entirely
    let effectiveMaxBytes = maxFileSizeBytes;
    let currentUsageBytes = 0;
    
    if (!isAuthenticated) {
      // Calculate current usage for IP (only for anonymous users)
      const shares = await prisma.share.findMany({
        where: { ipSource: clientIp, type: "FILE", filePath: { not: null } },
        select: { filePath: true },
      });
      
      for (const share of shares) {
        if (share.filePath) {
          const fullPath = path.join(uploadsDir, share.filePath);
          try {
            const stats = await stat(fullPath);
            currentUsageBytes += stats.size;
          } catch {}
        }
      }

      const remainingQuotaBytes = Math.max(0, ipQuotaBytes - currentUsageBytes);
      
      if (remainingQuotaBytes <= 0) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          error: `IP quota exceeded. Current usage: ${(currentUsageBytes / (1024 * 1024)).toFixed(2)} MB, Limit: ${ipQuotaMB} MB. Sign in for higher limits.`
        }));
        return;
      }

      effectiveMaxBytes = Math.min(maxFileSizeBytes, remainingQuotaBytes);
    }

    return new Promise((resolve) => {
      const fields = {};
      let tempFilePath = null;
      let originalFilename = null;
      let fileSize = 0;
      let aborted = false;
      let writeStream = null;

      const cleanup = () => {
        if (tempFilePath && existsSync(tempFilePath)) {
          try { unlinkSync(tempFilePath); } catch {}
        }
      };

      const sendError = (status, message) => {
        cleanup();
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
        resolve();
      };

      const busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: effectiveMaxBytes, files: 1 },
      });

      busboy.on("field", (name, value) => {
        fields[name] = value;
      });

      busboy.on("file", (name, fileStream, info) => {
        const { filename } = info;

        if (name !== "file" || !filename) {
          fileStream.resume();
          return;
        }

        // Validate filename
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
          fileStream.resume();
          aborted = true;
          sendError(400, "Invalid filename.");
          return;
        }

        if (filename.length > 255) {
          fileStream.resume();
          aborted = true;
          sendError(400, "Filename is too long (maximum 255 characters).");
          return;
        }

        originalFilename = filename;

        // Create temp file
        const tempFileName = `temp_${crypto.randomBytes(16).toString("hex")}`;
        tempFilePath = path.join(uploadsDir, tempFileName);
        writeStream = createWriteStream(tempFilePath);

        // Track size during streaming - NO BUFFERING
        fileStream.on("data", (chunk) => {
          fileSize += chunk.length;

          if (fileSize > effectiveMaxBytes && !aborted) {
            aborted = true;
            fileStream.destroy();
            writeStream?.destroy();
            sendError(413, `File size exceeds the allowed limit of ${maxFileSizeMB}MB.`);
          }
        });

        // Pipe directly to disk - TRUE STREAMING
        fileStream.pipe(writeStream);

        fileStream.on("limit", () => {
          if (!aborted) {
            aborted = true;
            fileStream.destroy();
            writeStream?.destroy();
            sendError(413, `File size exceeds the allowed limit of ${maxFileSizeMB}MB.`);
          }
        });

        fileStream.on("error", (err) => {
          if (!aborted) {
            aborted = true;
            console.error("File stream error:", err);
            sendError(500, "Error processing file upload.");
          }
        });

        writeStream.on("error", (err) => {
          if (!aborted) {
            aborted = true;
            console.error("Write stream error:", err);
            sendError(500, "Error saving file.");
          }
        });
      });

      busboy.on("close", async () => {
        if (aborted) return;

        try {
          // Wait for write to complete
          if (writeStream) {
            await new Promise((res, rej) => {
              writeStream.on("finish", res);
              writeStream.on("error", rej);
            });
          }

          if (!tempFilePath || !originalFilename) {
            sendError(400, "File required");
            return;
          }

          // Validate optional fields
          const slug = fields.slug?.trim();
          const password = fields.password?.trim();
          const expiresAtStr = fields.expiresAt;

          if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
            sendError(400, "Invalid slug format.");
            return;
          }

          // Parse expiration
          let expiresAt = null;
          if (expiresAtStr) {
            expiresAt = new Date(expiresAtStr);
            if (isNaN(expiresAt.getTime())) {
              sendError(400, "Invalid expiration date.");
              return;
            }
          }

          // Expiration rules:
          // - Anonymous users: MUST set expiration (max 7 days)
          // - Authenticated users: NO limit (expiration is optional)
          if (!isAuthenticated) {
            if (!expiresAt) {
              sendError(400, "Anonymous uploads require an expiration date (maximum 7 days).");
              return;
            }
            const maxExpiry = new Date();
            maxExpiry.setDate(maxExpiry.getDate() + 7);
            if (expiresAt > maxExpiry) {
              sendError(400, "Anonymous uploads cannot expire more than 7 days in the future.");
              return;
            }
          }

          // Hash password if provided
          let hashedPassword = null;
          if (password) {
            const bcrypt = await import("bcryptjs");
            hashedPassword = await bcrypt.default.hash(password, 12);
          }

          // Generate slug if not provided
          const finalSlug = slug || crypto.randomBytes(8).toString("hex").slice(0, 16);

          // Create database record
          const share = await prisma.share.create({
            data: {
              slug: finalSlug,
              type: "FILE",
              filePath: "",
              password: hashedPassword,
              expiresAt,
              ipSource: clientIp,
              ownerId: userId, // Associate with authenticated user if logged in
            },
          });

          // Rename temp file to final name
          const finalFileName = generateSafeFilename(originalFilename, share.id);
          const finalFilePath = path.join(uploadsDir, finalFileName);

          await rename(tempFilePath, finalFilePath);
          tempFilePath = null;

          // Update database with final file path
          await prisma.share.update({
            where: { id: share.id },
            data: { filePath: finalFileName },
          });

          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            share: {
              slug: share.slug,
              type: share.type,
              expiresAt: share.expiresAt,
              hasPassword: !!share.password,
            },
          }));
          resolve();
        } catch (err) {
          console.error("Error processing upload:", err);
          sendError(500, "Error processing upload.");
        }
      });

      busboy.on("error", (err) => {
        if (!aborted) {
          aborted = true;
          console.error("Busboy error:", err);
          sendError(500, "Error processing upload.");
        }
      });

      // Pipe request directly to busboy - NO NEXT.JS BUFFERING
      req.pipe(busboy);
    });
  } finally {
    await prisma.$disconnect();
  }
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Handle uploads BEFORE Next.js touches them
      if (pathname === "/api/upload" && req.method === "POST") {
        await handleUpload(req, res);
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
    console.log(`> Upload endpoint: http://${hostname}:${port}/api/upload (streaming enabled)`);
  });
});
