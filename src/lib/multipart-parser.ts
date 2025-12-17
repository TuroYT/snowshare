/**
 * Streaming multipart parser using busboy
 * Writes files directly to disk without loading into memory
 * Enforces size limits during streaming to prevent disk filling attacks
 */

import { NextRequest } from "next/server";
import { Readable } from "stream";
import Busboy from "busboy";
import { createWriteStream, existsSync, unlinkSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getUploadDir } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getClientIp } from "@/lib/getClientIp";

export interface ParsedFile {
  tempPath: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export interface ParsedFormData {
  fields: Record<string, string>;
  file?: ParsedFile;
}

export class FileSizeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileSizeLimitError";
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

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
  
  for (const share of shares) {
    if (share.filePath) {
      const fullPath = path.join(uploadsDir, share.filePath);
      try {
        const stats = await import("fs/promises").then(fs => fs.stat(fullPath));
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
async function getUploadLimits(req: NextRequest): Promise<UploadLimits> {
  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session;
  const ipAddress = getClientIp(req);
  
  const settings = await prisma.settings.findFirst();
  
  // Get limits in MB from settings
  const maxFileSizeMB = isAuthenticated
    ? (settings?.authMaxUpload || 51200)
    : (settings?.anoMaxUpload || 2048);
    
  const ipQuotaMB = isAuthenticated
    ? (settings?.authIpQuota || 102400)
    : (settings?.anoIpQuota || 4096);
  
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
 * Parse multipart form data with streaming file upload
 * Files are written directly to a temp location on disk
 * Size is validated DURING streaming to prevent disk filling attacks
 * IP quota is also enforced during streaming
 */
export async function parseMultipartStream(req: NextRequest): Promise<ParsedFormData> {
  const contentType = req.headers.get("content-type") || "";
  
  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Content-Type must be multipart/form-data");
  }

  // Get all limits BEFORE starting to write (includes IP quota check)
  const limits = await getUploadLimits(req);
  
  // Pre-check: if remaining quota is 0, reject immediately
  if (limits.remainingQuotaBytes <= 0) {
    const currentUsageMB = (limits.currentUsageBytes / (1024 * 1024)).toFixed(2);
    throw new QuotaExceededError(
      limits.isAuthenticated
        ? `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB`
        : `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB. Sign in for higher limits.`
    );
  }

  // The effective max size is the minimum of file size limit and remaining quota
  const effectiveMaxBytes = Math.min(limits.maxFileSizeBytes, limits.remainingQuotaBytes);

  // Ensure uploads directory exists
  const uploadsDir = getUploadDir();
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let parsedFile: ParsedFile | undefined;
    let fileWriteStream: ReturnType<typeof createWriteStream> | null = null;
    let tempFilePath: string | null = null;
    let fileSize = 0;
    let aborted = false;

    const cleanupOnError = () => {
      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          unlinkSync(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    const busboy = Busboy({
      headers: {
        "content-type": contentType,
      },
      limits: {
        fileSize: effectiveMaxBytes, // Enforce both file size and quota limits
        files: 1, // Only allow one file per request
      },
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, fileStream, info) => {
      const { filename, mimeType } = info;
      
      if (name !== "file" || !filename) {
        // Skip non-file fields or empty files
        fileStream.resume();
        return;
      }

      // Basic filename validation (prevent path traversal)
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        fileStream.resume();
        reject(new Error("Invalid filename."));
        return;
      }

      if (filename.length > 255) {
        fileStream.resume();
        reject(new Error("Filename is too long (maximum 255 characters)."));
        return;
      }

      // Generate a temporary filename
      const tempFileName = `temp_${crypto.randomBytes(16).toString("hex")}`;
      tempFilePath = path.join(uploadsDir, tempFileName);
      
      fileWriteStream = createWriteStream(tempFilePath);
      
      // Track file size during streaming and enforce limits
      fileStream.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;
        
        // Check against effective max (min of file size limit and remaining quota)
        if (fileSize > effectiveMaxBytes && !aborted) {
          aborted = true;
          fileStream.destroy();
          fileWriteStream?.destroy();
          cleanupOnError();
          
          // Determine which limit was exceeded
          if (fileSize > limits.remainingQuotaBytes) {
            const currentUsageMB = (limits.currentUsageBytes / (1024 * 1024)).toFixed(2);
            reject(new QuotaExceededError(
              limits.isAuthenticated
                ? `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB`
                : `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB. Sign in for higher limits.`
            ));
          } else {
            reject(new FileSizeLimitError(
              `File size exceeds the allowed limit of ${limits.maxFileSizeMB}MB.`
            ));
          }
        }
      });

      fileStream.pipe(fileWriteStream);

      // Handle busboy's file size limit event
      fileStream.on("limit", () => {
        aborted = true;
        fileStream.destroy();
        fileWriteStream?.destroy();
        cleanupOnError();
        
        // Determine which limit was exceeded
        if (fileSize > limits.remainingQuotaBytes) {
          const currentUsageMB = (limits.currentUsageBytes / (1024 * 1024)).toFixed(2);
          reject(new QuotaExceededError(
            limits.isAuthenticated
              ? `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB`
              : `IP quota exceeded. Current usage: ${currentUsageMB} MB, Limit: ${limits.ipQuotaMB} MB. Sign in for higher limits.`
          ));
        } else {
          reject(new FileSizeLimitError(
            `File size exceeds the allowed limit of ${limits.maxFileSizeMB}MB.`
          ));
        }
      });

      fileStream.on("end", () => {
        if (!aborted) {
          parsedFile = {
            tempPath: tempFilePath!,
            originalName: filename,
            size: fileSize,
            mimeType: mimeType || "application/octet-stream",
          };
        }
      });

      fileStream.on("error", (err) => {
        cleanupOnError();
        reject(err);
      });

      fileWriteStream.on("error", (err) => {
        cleanupOnError();
        reject(err);
      });
    });

    busboy.on("finish", () => {
      if (aborted) return;
      
      // Wait for file write to complete if there's a file
      if (fileWriteStream) {
        fileWriteStream.on("finish", () => {
          resolve({ fields, file: parsedFile });
        });
      } else {
        resolve({ fields, file: parsedFile });
      }
    });

    busboy.on("error", (err) => {
      cleanupOnError();
      reject(err);
    });

    // Convert Web API ReadableStream to Node.js Readable and pipe to busboy
    const webStream = req.body;
    if (!webStream) {
      reject(new Error("Request body is empty"));
      return;
    }

    const nodeStream = Readable.fromWeb(webStream as import("stream/web").ReadableStream);
    nodeStream.pipe(busboy);
  });
}

/**
 * Clean up a temporary file
 */
export function cleanupTempFile(tempPath: string): void {
  try {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
