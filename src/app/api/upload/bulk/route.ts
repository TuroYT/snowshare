import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import { Readable } from "node:stream";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  saveBulkFile,
  validateFilePath,
  normalizeRelativePath,
  ensureUploadDirectory,
  UploadedFileInfo,
} from "@/lib/bulk-upload-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FileData {
  buffer: Buffer;
  filename: string;
  relativePath: string;
  mimeType: string;
}

async function calculateIpUploadSizeBytes(ipAddress: string): Promise<number> {
  const shares = await prisma.share.findMany({
    where: {
      ipSource: ipAddress,
      type: "FILE",
    },
    select: {
      filePath: true,
      files: {
        select: {
          size: true,
        },
      },
    },
  });

  let totalSize = 0;

  for (const share of shares) {
    if (share.files && share.files.length > 0) {
      for (const file of share.files) {
        totalSize += Number(file.size);
      }
    }
  }

  return totalSize;
}

async function getUploadLimits(req: NextRequest, isAuthenticated: boolean) {
  const ipAddress = getClientIp(req);
  const settings = await prisma.settings.findFirst();

  const maxFileSizeMB = isAuthenticated
    ? settings?.authMaxUpload || 51200
    : settings?.anoMaxUpload || 2048;

  const ipQuotaMB = isAuthenticated
    ? settings?.authIpQuota || 102400
    : settings?.anoIpQuota || 4096;

  const currentUsageBytes = await calculateIpUploadSizeBytes(ipAddress);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  const ipQuotaBytes = ipQuotaMB * 1024 * 1024;
  const remainingQuotaBytes = Math.max(0, ipQuotaBytes - currentUsageBytes);

  return {
    maxFileSizeBytes,
    ipQuotaBytes,
    currentUsageBytes,
    remainingQuotaBytes,
    isAuthenticated,
  };
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data" },
      { status: 400 }
    );
  }

  if (!req.body) {
    return NextResponse.json(
      { error: "Request body is required" },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  const isAuthenticated = !!session?.user;
  const clientIp = getClientIp(req);

  const limits = await getUploadLimits(req, isAuthenticated);

  if (limits.remainingQuotaBytes <= 0) {
    return NextResponse.json(
      {
        error: isAuthenticated
          ? "IP quota exceeded"
          : "IP quota exceeded. Sign in for higher limits.",
      },
      { status: 429 }
    );
  }

  await ensureUploadDirectory();

  return new Promise<NextResponse>((resolve) => {
    const fields: Record<string, string> = {};
    const filesData: FileData[] = [];
    let totalSize = 0;
    let aborted = false;

    const sendError = (status: number, message: string) => {
      resolve(NextResponse.json({ error: message }, { status }));
    };

    const sendSuccess = (data: object) => {
      resolve(NextResponse.json(data, { status: 201 }));
    };

    const headers = Object.fromEntries(req.headers);
    const busboy = Busboy({
      headers,
      limits: {
        fileSize: limits.maxFileSizeBytes * 2,
      },
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, fileStream, info) => {
      const { filename, mimeType } = info;

      if (!filename) {
        fileStream.resume();
        return;
      }

      if (
        filename.includes("..") ||
        filename.includes("\\") ||
        filename.length > 255
      ) {
        fileStream.resume();
        aborted = true;
        sendError(400, "Invalid filename");
        return;
      }

      const chunks: Buffer[] = [];
      const relativePathRaw = fields[`${name}_path`] || filename;
      const relativePath = normalizeRelativePath(relativePathRaw);

      if (!validateFilePath(relativePath)) {
        fileStream.resume();
        aborted = true;
        sendError(400, "Invalid file path");
        return;
      }

      fileStream.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > limits.remainingQuotaBytes && !aborted) {
          aborted = true;
          fileStream.destroy();
          sendError(429, "IP quota exceeded");
          return;
        }

        chunks.push(chunk);
      });

      fileStream.on("end", () => {
        if (!aborted) {
          filesData.push({
            buffer: Buffer.concat(chunks),
            filename,
            relativePath,
            mimeType: mimeType || "application/octet-stream",
          });
        }
      });

      fileStream.on("error", () => {
        if (!aborted) {
          aborted = true;
          sendError(500, "Error processing file");
        }
      });
    });

    busboy.on("close", async () => {
      if (aborted) return;

      try {
        if (filesData.length === 0) {
          return sendError(400, "No files uploaded");
        }

        const slug = fields.slug?.trim();
        const password = fields.password?.trim();
        const expiresAtStr = fields.expiresAt;

        if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
          return sendError(400, "Invalid slug");
        }

        if (slug) {
          const existingShare = await prisma.share.findUnique({
            where: { slug },
          });
          if (existingShare) {
            return sendError(409, "Slug already taken");
          }
        }

        let expiresAt: Date | null = null;
        if (expiresAtStr) {
          expiresAt = new Date(expiresAtStr);
          if (isNaN(expiresAt.getTime())) {
            return sendError(400, "Invalid expiration date");
          }
        }

        if (!isAuthenticated) {
          const defaultAnonExpiry = new Date();
          defaultAnonExpiry.setDate(defaultAnonExpiry.getDate() + 7);

          if (!expiresAt) {
            expiresAt = defaultAnonExpiry;
          } else {
            const maxExpiry = new Date();
            maxExpiry.setDate(maxExpiry.getDate() + 7);
            if (expiresAt > maxExpiry) {
              return sendError(
                400,
                "Anonymous uploads cannot expire more than 7 days in the future"
              );
            }
          }
        }

        let hashedPassword: string | null = null;
        if (password) {
          hashedPassword = await bcrypt.hash(password, 12);
        }

        const finalSlug = slug || crypto.randomBytes(8).toString("hex").slice(0, 16);

        const share = await prisma.share.create({
          data: {
            slug: finalSlug,
            type: "FILE",
            password: hashedPassword,
            expiresAt,
            ipSource: clientIp,
            ownerId: session?.user?.id || null,
            isBulk: true,
          },
        });

        const uploadedFiles: UploadedFileInfo[] = [];
        for (const fileData of filesData) {
          const uploadedFile = await saveBulkFile(
            fileData.buffer,
            fileData.filename,
            fileData.relativePath,
            share.id
          );
          uploadedFiles.push(uploadedFile);

          await prisma.shareFile.create({
            data: {
              shareId: share.id,
              filePath: uploadedFile.filePath,
              originalName: uploadedFile.originalName,
              relativePath: uploadedFile.relativePath,
              size: BigInt(uploadedFile.size),
              mimeType: uploadedFile.mimeType,
            },
          });
        }

        sendSuccess({
          share: {
            slug: share.slug,
            type: share.type,
            isBulk: true,
            fileCount: uploadedFiles.length,
            totalSize: totalSize,
            expiresAt: share.expiresAt,
            hasPassword: !!share.password,
          },
        });
      } catch (err) {
        console.error("Error processing bulk upload:", err);
        sendError(500, "Error processing upload");
      }
    });

    busboy.on("error", () => {
      if (!aborted) {
        aborted = true;
        sendError(500, "Error processing upload");
      }
    });

    const nodeStream = Readable.fromWeb(
      req.body as unknown as import("stream/web").ReadableStream
    );
    nodeStream.pipe(busboy);
  });
}
