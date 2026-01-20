/**
 * File upload endpoint using App Router with streaming
 * Uses Readable.fromWeb() to convert Web API stream to Node.js stream for busboy
 * This avoids loading files into memory
 */

import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import { Readable } from "node:stream";
import { createWriteStream, existsSync, statSync } from "fs";
import { mkdir, rename, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadDir } from "@/lib/constants";
import bcrypt from "bcryptjs";
import { findOrCreateIpAddress } from "@/lib/ipAddress";

// Force Node.js runtime (not Edge)
export const runtime = "nodejs";

// Disable static optimization
export const dynamic = "force-dynamic";

/**
 * Convert MB to display unit (MiB or GiB)
 */
function convertFromMBForDisplay(megabytes: number, useGiB: boolean): number {
  if (useGiB) {
    // 1 GiB = 1024 MiB
    return Math.round((megabytes / 1024) * 100) / 100;
  } else {
    // MiB = MB (1:1 for practical purposes)
    return megabytes;
  }
}

/**
 * Get display unit label
 */
function getUnitLabel(useGiB: boolean): string {
  return useGiB ? "GiB" : "MiB";
}

interface UploadLimits {
  maxFileSizeBytes: number;
  maxFileSizeMB: number;
  ipQuotaBytes: number;
  ipQuotaMB: number;
  currentUsageBytes: number;
  remainingQuotaBytes: number;
  isAuthenticated: boolean;
  useGiB: boolean;
}

/**
 * Get client IP from request headers
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Calculate total upload size for an IP address (in bytes)
 */
async function calculateIpUploadSizeBytes(ipAddress: string): Promise<number> {
  const shares = await prisma.share.findMany({
    where: {
      ipAddress: {
        ip: ipAddress,
      },
      type: "FILE",
      filePath: { not: null },
    },
    select: {
      filePath: true,
    },
  });

  let totalSize = 0;
  const uploadsDir = getUploadDir();
  const fs = await import("fs/promises");

  for (const share of shares) {
    if (share.filePath) {
      const fullPath = path.join(uploadsDir, share.filePath);
      try {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  return totalSize;
}

/**
 * Get all upload limits based on authentication status and current usage
 */
async function getUploadLimits(
  req: NextRequest,
  isAuthenticated: boolean
): Promise<UploadLimits> {
  const ipAddress = getClientIp(req);
  const settings = await prisma.settings.findFirst();

  // Get limits in MB from settings
  const maxFileSizeMB = isAuthenticated
    ? settings?.authMaxUpload || 51200
    : settings?.anoMaxUpload || 2048;

  const ipQuotaMB = isAuthenticated
    ? settings?.authIpQuota || 102400
    : settings?.anoIpQuota || 4096;

  const useGiB = isAuthenticated
    ? settings?.useGiBForAuth ?? false
    : settings?.useGiBForAnon ?? false;

  // Calculate current usage
  const currentUsageBytes = await calculateIpUploadSizeBytes(ipAddress);

  // Convert to bytes
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  const ipQuotaBytes = ipQuotaMB * 1024 * 1024;
  const remainingQuotaBytes = Math.max(0, ipQuotaBytes - currentUsageBytes);

  return {
    maxFileSizeBytes,
    maxFileSizeMB,
    ipQuotaBytes,
    ipQuotaMB,
    currentUsageBytes,
    remainingQuotaBytes,
    isAuthenticated,
    useGiB,
  };
}

/**
 * Generate safe filename
 */
function generateSafeFilename(originalName: string, shareId: string): string {
  const ext = path.extname(originalName);
  const baseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${shareId}_${baseName}${ext}`;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 400 }
    );
  }

  // Check if body exists
  if (!req.body) {
    return NextResponse.json(
      { error: "Request body is required" },
      { status: 400 }
    );
  }

  // Get session for auth check
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;
  const clientIp = getClientIp(req);

  // Get limits BEFORE starting to receive the file
  const limits = await getUploadLimits(req, isAuthenticated);

  // Parse chunk headers
  const chunkIndexHeader = req.headers.get("x-chunk-index");
  const totalChunksHeader = req.headers.get("x-total-chunks");
  const uploadIdHeader = req.headers.get("x-upload-id");
  const isChunked = chunkIndexHeader !== null && totalChunksHeader !== null && uploadIdHeader !== null;
  
  const chunkIndex = isChunked ? parseInt(chunkIndexHeader!, 10) : 0;
  const totalChunks = isChunked ? parseInt(totalChunksHeader!, 10) : 1;
  const uploadId = isChunked ? uploadIdHeader! : crypto.randomBytes(16).toString("hex");

  // Security: Validate uploadId to prevent directory traversal
  if (isChunked && !/^[a-zA-Z0-9-]+$/.test(uploadId)) {
      return NextResponse.json({ error: "Invalid upload ID" }, { status: 400 });
  }

  // Pre-check: if remaining quota is 0, reject immediately (only for new upload/first chunk)
  if (chunkIndex === 0 && limits.remainingQuotaBytes <= 0) {
    const unitLabel = getUnitLabel(limits.useGiB);
    const currentUsageDisplay = convertFromMBForDisplay(Math.round(limits.currentUsageBytes / (1024 * 1024)), limits.useGiB);
    const ipQuotaDisplay = convertFromMBForDisplay(limits.ipQuotaMB, limits.useGiB);
    return NextResponse.json(
      {
        error: isAuthenticated
          ? `IP quota exceeded. Current usage: ${currentUsageDisplay}${unitLabel}, Limit: ${ipQuotaDisplay}${unitLabel}`
          : `IP quota exceeded. Current usage: ${currentUsageDisplay}${unitLabel}, Limit: ${ipQuotaDisplay}${unitLabel}. Sign in for higher limits.`,
      },
      { status: 429 }
    );
  }

  // Effective max is minimum of file size limit and remaining quota
  const effectiveMaxBytes = Math.min(
    limits.maxFileSizeBytes,
    limits.remainingQuotaBytes
  );

  // Ensure uploads directory exists
  const uploadsDir = getUploadDir();
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  return new Promise<NextResponse>((resolve) => {
    const fields: Record<string, string> = {};
    let tempFilePath: string | null = null;
    let originalFilename: string | null = null;
    let fileSize = 0;
    let aborted = false;
    let fileWriteStream: ReturnType<typeof createWriteStream> | null = null;

    // For chunked uploads, use persistent temp file name
    const tempFileName = isChunked ? `temp_upload_${uploadId}` : `temp_${crypto.randomBytes(16).toString("hex")}`;
    tempFilePath = path.join(uploadsDir, tempFileName);

    const cleanup = async () => {
      // Delete temp file if aborted or error
      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          await unlink(tempFilePath);
        } catch {
          // Ignore
        }
      }
    };

    const sendError = async (status: number, message: string) => {
      if (aborted) {
          await cleanup();
      }
      resolve(NextResponse.json({ error: message }, { status }));
    };

    const sendSuccess = (data: object) => {
      resolve(NextResponse.json(data, { status: 201 }));
    };

    // Convert Web API headers to plain object for busboy
    const headers = Object.fromEntries(req.headers);

    const busboy = Busboy({
      headers,
      limits: {
        fileSize: limits.maxFileSizeBytes * 2, // Check manually
        files: 1,
      },
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
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
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
         if (existsSync(tempFilePath!)) {
             const stats = statSync(tempFilePath!);
             fileSize = stats.size;
         } else {
             fileStream.resume();
             aborted = true;
             sendError(400, "Upload session expired or invalid.");
             return;
         }
      }

      const flags = (isChunked && chunkIndex > 0) ? 'a' : 'w';
      fileWriteStream = createWriteStream(tempFilePath!, { flags });

      // Track size during streaming
      fileStream.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;

        // Double-check limits during streaming
        if (fileSize > effectiveMaxBytes && !aborted) {
          aborted = true;
          fileStream.destroy();
          fileWriteStream?.destroy();

          const unitLabel = getUnitLabel(limits.useGiB);
          if (fileSize > limits.remainingQuotaBytes) {
            const currentUsageMB = Math.round(limits.currentUsageBytes / (1024 * 1024));
            const currentUsageDisplay = convertFromMBForDisplay(currentUsageMB, limits.useGiB);
            const ipQuotaDisplay = convertFromMBForDisplay(limits.ipQuotaMB, limits.useGiB);
            sendError(
              429,
              limits.isAuthenticated
                ? `IP quota exceeded. Current usage: ${currentUsageDisplay}${unitLabel}, Limit: ${ipQuotaDisplay}${unitLabel}`
                : `IP quota exceeded. Current usage: ${currentUsageDisplay}${unitLabel}, Limit: ${ipQuotaDisplay}${unitLabel}. Sign in for higher limits.`
            );
          } else {
            const maxFileSizeDisplay = convertFromMBForDisplay(limits.maxFileSizeMB, limits.useGiB);
            sendError(
              413,
              `File size exceeds the allowed limit of ${maxFileSizeDisplay}${unitLabel}.`
            );
          }
        }
      });

      fileStream.pipe(fileWriteStream);

      // Handle busboy's file size limit (backup)
      fileStream.on("limit", () => {
        if (aborted) return;
        aborted = true;
        fileStream.destroy();
        fileWriteStream?.destroy();
         sendError(413, `File size limit exceeded.`);
      });

      fileStream.on("error", (err) => {
        if (aborted) return;
        aborted = true;
        console.error("File stream error:", err);
        sendError(500, "Error processing file upload.");
      });

      fileWriteStream.on("error", (err) => {
        if (aborted) return;
        aborted = true;
        console.error("Write stream error:", err);
        sendError(500, "Error saving file.");
      });
    });

    busboy.on("close", async () => {
      if (aborted) return;

      try {
        // Wait for file write to complete
        if (fileWriteStream) {
          await new Promise<void>((resolveWrite, rejectWrite) => {
            fileWriteStream!.on("finish", resolveWrite);
            fileWriteStream!.on("error", rejectWrite);
          });
        }
        
        // Chunk intermediate success
        if (isChunked && chunkIndex < totalChunks - 1) {
             return sendSuccess({ 
                 status: "chunk_received", 
                 index: chunkIndex,
                 nextIndex: chunkIndex + 1
             });
        }

        // --- Finalize Logic (Only if not chunked or last chunk) ---

        // Validate required fields
        if (fields.type !== "FILE") {
           // Should ideally be present in last chunk
        }
        

        if (!tempFilePath || !originalFilename) {
          return sendError(400, "File required or upload error");
        }

        // Validate optional fields
        const slug = fields.slug?.trim();
        const password = fields.password?.trim();
        const expiresAtStr = fields.expiresAt;

        if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
          aborted = true; 
          await cleanup();
          return sendError(
            400,
            "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores."
          );
        }

        // Check slug uniqueness
        if (slug) {
          const existingShare = await prisma.share.findUnique({
            where: { slug },
          });
          if (existingShare) {
            aborted = true;
            await cleanup();
            return sendError(
              409,
              "This custom URL is already taken. Please choose another one."
            );
          }
        }

        // Parse and validate expiration
        let expiresAt: Date | null = null;
        if (expiresAtStr) {
          expiresAt = new Date(expiresAtStr);
          if (isNaN(expiresAt.getTime())) {
             aborted = true;
             await cleanup();
            return sendError(400, "Invalid expiration date.");
          }
        }

        // Anonymous users must set expiration (max 7 days)
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
                return sendError(
                  400,
                  "Anonymous uploads cannot expire more than 7 days in the future."
                );
             }
          }
        }

        // Hash password if provided
        let hashedPassword: string | null = null;
        if (password) {
          hashedPassword = await bcrypt.hash(password, 12);
        }

        // Generate slug if not provided
        const finalSlug =
          slug || crypto.randomBytes(8).toString("hex").slice(0, 16);

        // Find or create IP address record
        const ipAddressId = await findOrCreateIpAddress(clientIp);

        // Create database record
        const share = await prisma.share.create({
          data: {
            slug: finalSlug,
            type: "FILE",
            filePath: "", // Will update after rename
            password: hashedPassword,
            expiresAt,
            ipAddressId,
            ownerId: session?.user?.id || null,
          },
        });

        // Rename temp file to final name
        const finalFileName = generateSafeFilename(originalFilename, share.id);
        const finalFilePath = path.join(uploadsDir, finalFileName);

        await rename(tempFilePath, finalFilePath);
        tempFilePath = null; // Prevent cleanup of renamed file

        // Update database with final file path
        await prisma.share.update({
          where: { id: share.id },
          data: { filePath: finalFileName },
        });

        sendSuccess({
          share: {
            slug: share.slug,
            type: share.type,
            filename: originalFilename,
            expiresAt: share.expiresAt,
            hasPassword: !!share.password,
          },
        });
      } catch (err) {
        console.error("Error processing upload:", err);
        aborted = true;
        sendError(500, "Error processing upload.");
      }
    });

    busboy.on("error", (err) => {
      if (aborted) return;
      aborted = true;
      console.error("Busboy error:", err);
      sendError(500, "Error processing upload.");
    });

    // Convert Web API ReadableStream to Node.js Readable and pipe to busboy
    const nodeStream = Readable.fromWeb(
      req.body as unknown as import("stream/web").ReadableStream
    );
    nodeStream.pipe(busboy);
  });
}
