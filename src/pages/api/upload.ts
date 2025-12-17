/**
 * File upload endpoint using Pages Router to avoid Next.js App Router body buffering
 * This endpoint uses raw HTTP streams to avoid loading files into memory
 */

import type { NextApiRequest, NextApiResponse } from "next";
import Busboy from "busboy";
import { createWriteStream, existsSync, unlinkSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadDir } from "@/lib/constants";
import bcrypt from "bcryptjs";

// Disable Next.js body parsing - we handle it ourselves with busboy
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface UploadLimits {
  maxFileSizeBytes: number;
  maxFileSizeMB: number;
  ipQuotaBytes: number;
  ipQuotaMB: number;
  currentUsageBytes: number;
  remainingQuotaBytes: number;
  isAuthenticated: boolean;
}

/**
 * Get client IP from request
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Calculate total upload size for an IP address (in bytes)
 */
async function calculateIpUploadSizeBytes(ipAddress: string): Promise<number> {
  const shares = await prisma.share.findMany({
    where: {
      ipSource: ipAddress,
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
  req: NextApiRequest,
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
  }

  // Get session for auth check
  const session = await getServerSession(req, res, authOptions);
  const isAuthenticated = !!session?.user;
  const clientIp = getClientIp(req);

  // Get limits BEFORE starting to receive the file
  const limits = await getUploadLimits(req, isAuthenticated);

  // Pre-check: if remaining quota is 0, reject immediately
  if (limits.remainingQuotaBytes <= 0) {
    const currentUsageMB = (limits.currentUsageBytes / (1024 * 1024)).toFixed(2);
    return res.status(429).json({
      error: isAuthenticated
        ? `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB`
        : `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB. Sign in for higher limits.`,
    });
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

  return new Promise<void>((resolve) => {
    const fields: Record<string, string> = {};
    let tempFilePath: string | null = null;
    let originalFilename: string | null = null;
    let fileSize = 0;
    let aborted = false;
    let fileWriteStream: ReturnType<typeof createWriteStream> | null = null;

    const cleanup = () => {
      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          unlinkSync(tempFilePath);
        } catch {
          // Ignore
        }
      }
    };

    const sendError = (status: number, message: string) => {
      cleanup();
      res.status(status).json({ error: message });
      resolve();
    };

    const busboy = Busboy({
      headers: req.headers as Record<string, string>,
      limits: {
        fileSize: effectiveMaxBytes,
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

      // Create temp file
      const tempFileName = `temp_${crypto.randomBytes(16).toString("hex")}`;
      tempFilePath = path.join(uploadsDir, tempFileName);
      fileWriteStream = createWriteStream(tempFilePath);

      // Track size during streaming
      fileStream.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;

        // Double-check limits during streaming
        if (fileSize > effectiveMaxBytes && !aborted) {
          aborted = true;
          fileStream.destroy();
          fileWriteStream?.destroy();

          if (fileSize > limits.remainingQuotaBytes) {
            const currentUsageMB = (
              limits.currentUsageBytes /
              (1024 * 1024)
            ).toFixed(2);
            sendError(
              429,
              limits.isAuthenticated
                ? `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB`
                : `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB. Sign in for higher limits.`
            );
          } else {
            sendError(
              413,
              `File size exceeds the allowed limit of ${limits.maxFileSizeMB}MB.`
            );
          }
        }
      });

      fileStream.pipe(fileWriteStream);

      // Handle busboy's file size limit
      fileStream.on("limit", () => {
        if (aborted) return;
        aborted = true;
        fileStream.destroy();
        fileWriteStream?.destroy();

        if (fileSize > limits.remainingQuotaBytes) {
          const currentUsageMB = (
            limits.currentUsageBytes /
            (1024 * 1024)
          ).toFixed(2);
          sendError(
            429,
            limits.isAuthenticated
              ? `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB`
              : `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB. Sign in for higher limits.`
          );
        } else {
          sendError(
            413,
            `File size exceeds the allowed limit of ${limits.maxFileSizeMB}MB.`
          );
        }
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

    busboy.on("finish", async () => {
      if (aborted) return;

      try {
        // Wait for file write to complete
        if (fileWriteStream) {
          await new Promise<void>((resolveWrite, rejectWrite) => {
            fileWriteStream!.on("finish", resolveWrite);
            fileWriteStream!.on("error", rejectWrite);
          });
        }

        // Validate required fields
        if (fields.type !== "FILE") {
          return sendError(400, "Invalid share type for file upload");
        }

        if (!tempFilePath || !originalFilename) {
          return sendError(400, "File required");
        }

        // Validate optional fields
        const slug = fields.slug?.trim();
        const password = fields.password?.trim();
        const expiresAtStr = fields.expiresAt;

        if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
          return sendError(
            400,
            "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores."
          );
        }

        let expiresAt: Date | undefined;
        if (expiresAtStr) {
          expiresAt = new Date(expiresAtStr);
          if (expiresAt <= new Date()) {
            return sendError(400, "Expiration date must be in the future.");
          }
        }

        if (password && (password.length < 6 || password.length > 100)) {
          return sendError(
            400,
            "Password must be between 6 and 100 characters."
          );
        }

        // Anonymous user restrictions
        if (!session) {
          if (expiresAt) {
            const maxExpiry = new Date();
            maxExpiry.setDate(maxExpiry.getDate() + 7);
            if (expiresAt > maxExpiry) {
              return sendError(
                400,
                "Unauthenticated users cannot create shares that expire beyond 7 days."
              );
            }
          } else {
            return sendError(
              400,
              "Unauthenticated users must provide an expiration date."
            );
          }
        }

        // Hash password if provided
        let hashedPassword: string | null = null;
        if (password) {
          hashedPassword = await bcrypt.hash(password, 12);
        }

        // Generate unique slug if not provided
        let finalSlug = slug;
        if (!finalSlug) {
          do {
            finalSlug = crypto.randomBytes(6).toString("base64url");
          } while (await prisma.share.findUnique({ where: { slug: finalSlug } }));
        }

        // Create share in database
        const fileShare = await prisma.share.create({
          data: {
            type: "FILE",
            slug: finalSlug,
            password: hashedPassword,
            expiresAt,
            ownerId: session?.user?.id || null,
            filePath: null,
            ipSource: clientIp,
          },
        });

        // Rename temp file to final location
        const safeFilename = generateSafeFilename(originalFilename, fileShare.id);
        const finalPath = path.join(uploadsDir, safeFilename);

        const fs = await import("fs");
        fs.renameSync(tempFilePath, finalPath);
        tempFilePath = null; // Don't cleanup since we renamed it

        // Update share with file path
        const updatedShare = await prisma.share.update({
          where: { id: fileShare.id },
          data: { filePath: safeFilename },
        });

        res.status(201).json({
          share: { fileShare: updatedShare },
        });
        resolve();
      } catch (error) {
        console.error("Error creating file share:", error);
        sendError(500, "Error creating file share.");
      }
    });

    busboy.on("error", (err) => {
      if (aborted) return;
      aborted = true;
      console.error("Busboy error:", err);
      sendError(500, "Error processing upload.");
    });

    // Pipe the request directly to busboy - NO BUFFERING
    req.pipe(busboy);
  });
}
