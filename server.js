/**
 * Custom Node.js server for SnowShare
 * Handles file uploads OUTSIDE of Next.js to avoid body buffering
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import Busboy from "busboy";
import { createWriteStream, existsSync, unlinkSync, mkdirSync, statSync } from "fs";
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

  try {
    // Import singleton Prisma instance
    const { prisma } = await import("./src/lib/prisma.js");
    
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

    // NEW: Chunking Headers
    const chunkIndexHeader = req.headers["x-chunk-index"];
    const totalChunksHeader = req.headers["x-total-chunks"];
    const uploadIdHeader = req.headers["x-upload-id"];
    
    const isChunked = chunkIndexHeader !== undefined && totalChunksHeader !== undefined && uploadIdHeader !== undefined;
    const chunkIndex = isChunked ? parseInt(chunkIndexHeader, 10) : 0;
    const totalChunks = isChunked ? parseInt(totalChunksHeader, 10) : 1;
    const uploadId = isChunked ? uploadIdHeader : crypto.randomBytes(16).toString("hex");

    // Security: Validate uploadId
    if (isChunked && !/^[a-zA-Z0-9-]+$/.test(uploadId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid upload ID" }));
        return;
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
    let remainingQuotaBytes = Infinity;
    
    if (!isAuthenticated && chunkIndex === 0) {
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
          } catch {
            // Ignore stat errors on non-existent file paths
        }
        }
      }

      remainingQuotaBytes = Math.max(0, ipQuotaBytes - currentUsageBytes);
      
      // Check quota only at start
      if (remainingQuotaBytes <= 0) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          error: `IP quota exceeded. Current usage: ${(currentUsageBytes / (1024 * 1024)).toFixed(2)} MB, Limit: ${ipQuotaMB} MB. Sign in for higher limits.`
        }));
        return;
      }

      effectiveMaxBytes = Math.min(maxFileSizeBytes, remainingQuotaBytes);
    } else if (!isAuthenticated && chunkIndex > 0) {
        // Skip heavy quota check for subsequent chunks
        effectiveMaxBytes = maxFileSizeBytes;
    }

    return new Promise((resolve) => {
      const fields = {};
      let tempFilePath = null;
      let originalFilename = null;
      let fileSize = 0;
      let aborted = false;
      let writeStream = null;
      
      // For chunked uploads, use persistent temp file name
      const tempFileName = isChunked ? `temp_upload_${uploadId}` : `temp_${uploadId}`;
      tempFilePath = path.join(uploadsDir, tempFileName);

      const cleanup = async () => {
        if (tempFilePath && existsSync(tempFilePath)) {
          try {
             await unlink(tempFilePath);
          } catch {
             // Ignore
          }
        }
      };

      const sendError = (status, message) => {
        if (aborted) {
            cleanup().catch(console.error);
        }
        if (!res.headersSent) {
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: message }));
        }
        resolve();
      };

      const sendSuccess = (data) => {
        if (!res.headersSent) {
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data));
        }
        resolve();
      };

      const busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: isChunked ? Infinity : effectiveMaxBytes, files: 1 },
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

         // Handle chunk appending: Check prior existence if chunk > 0
         if (isChunked && chunkIndex > 0) {
            if (existsSync(tempFilePath)) {
                const stats = statSync(tempFilePath);
                fileSize = stats.size;
            } else {
                fileStream.resume();
                aborted = true;
                sendError(400, "Upload session expired or invalid.");
                return;
            }
         }

        const flags = (isChunked && chunkIndex > 0) ? 'a' : 'w';
        writeStream = createWriteStream(tempFilePath, { flags });

        // Track size during streaming - NO BUFFERING
        fileStream.on("data", (chunk) => {
          fileSize += chunk.length;

          if (fileSize > effectiveMaxBytes && !aborted) {
            aborted = true;
            fileStream.destroy();
            writeStream?.destroy();
            
            if (!isAuthenticated && fileSize > remainingQuotaBytes) {
                sendError(429, `IP quota exceeded.`);
            } else {
                sendError(413, `File size exceeds the allowed limit of ${maxFileSizeMB}MB.`);
            }
          }
        });

        // Pipe directly to disk - TRUE STREAMING
        fileStream.pipe(writeStream);

        fileStream.on("limit", () => {
          if (!aborted) {
            aborted = true;
            fileStream.destroy();
            writeStream?.destroy();
            sendError(413, `File size limited.`);
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
          
          // Chunk intermediate success
          if (isChunked && chunkIndex < totalChunks - 1) {
              sendSuccess({ 
                status: "chunk_received", 
                index: chunkIndex,
                nextIndex: chunkIndex + 1
              });
              return;
          }

          if (!tempFilePath || !originalFilename) {
            sendError(400, "File required");
            return;
          }
          
          if (!fields.type) fields.type = "FILE";

          // Validate optional fields
          const slug = fields.slug?.trim();
          const password = fields.password?.trim();
          const expiresAtStr = fields.expiresAt;

          if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
            aborted = true;
            await cleanup();
            sendError(400, "Invalid slug format.");
            return;
          }
          
           // Check slug uniqueness
          if (slug) {
            const existingShare = await prisma.share.findUnique({
              where: { slug },
            });
            if (existingShare) {
               aborted = true;
               await cleanup();
              sendError(409, "This custom URL is already taken. Please choose another one.");
              return;
            }
          }

          // Parse expiration
          let expiresAt = null;
          if (expiresAtStr) {
            expiresAt = new Date(expiresAtStr);
            if (isNaN(expiresAt.getTime())) {
               aborted = true;
               await cleanup();
              sendError(400, "Invalid expiration date.");
              return;
            }
          }

          // Expiration rules
          if (!isAuthenticated) {
            const defaultAnonExpiry = new Date();
            defaultAnonExpiry.setDate(defaultAnonExpiry.getDate() + 7);

            if (!expiresAt) {
               expiresAt = defaultAnonExpiry;
            } else {
                const maxExpiry = new Date();
                maxExpiry.setDate(maxExpiry.getDate() + 7);
                if (expiresAt > maxExpiry) {
                 aborted = true;
                 await cleanup();
                  sendError(400, "Anonymous uploads cannot expire more than 7 days in the future.");
                  return;
                }
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
          tempFilePath = null; // Prevent cleanup

          // Update database with final file path
          await prisma.share.update({
            where: { id: share.id },
            data: { filePath: finalFileName },
          });

          sendSuccess({
            share: {
              slug: share.slug,
              type: share.type,
              expiresAt: share.expiresAt,
              hasPassword: !!share.password,
            },
          });
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
  } catch (err) {
    console.error("Error in upload handler:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
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
