import { createWriteStream, existsSync } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import archiver from "archiver";
import { Readable } from "stream";
import crypto from "crypto";
import { getUploadDir } from "./constants";

export interface FileEntry {
  file: File;
  relativePath: string;
}

export interface UploadedFileInfo {
  filePath: string;
  originalName: string;
  relativePath: string;
  size: number;
  mimeType: string;
}

export function generateBulkUploadId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function ensureUploadDirectory(): Promise<string> {
  const uploadsDir = getUploadDir();
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

export async function saveBulkFile(
  fileBuffer: Buffer,
  originalName: string,
  relativePath: string,
  shareId: string
): Promise<UploadedFileInfo> {
  const uploadsDir = await ensureUploadDirectory();
  const safeFileName = generateSafeFilename(originalName, shareId);
  const filePath = path.join(uploadsDir, safeFileName);

  await mkdir(path.dirname(filePath), { recursive: true });
  
  const writeStream = createWriteStream(filePath);
  await pipeline(Readable.from(fileBuffer), writeStream);

  const stats = await stat(filePath);

  return {
    filePath: safeFileName,
    originalName,
    relativePath,
    size: stats.size,
    mimeType: getMimeType(originalName),
  };
}

export function generateSafeFilename(originalName: string, shareId: string): string {
  const ext = path.extname(originalName);
  const baseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 100);
  const uniqueId = crypto.randomBytes(8).toString("hex");
  return `${shareId}_${uniqueId}_${baseName}${ext}`;
}

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function createZipStream(
  files: Array<{ filePath: string; originalName: string; relativePath: string }>
): Promise<Readable> {
  const archive = archiver('zip', {
    zlib: { level: 6 }
  });

  const uploadsDir = getUploadDir();

  for (const file of files) {
    const fullPath = path.join(uploadsDir, file.filePath);
    if (existsSync(fullPath)) {
      const displayPath = file.relativePath || file.originalName;
      archive.file(fullPath, { name: displayPath });
    }
  }

  archive.finalize();
  return archive;
}

export function validateFilePath(filePath: string): boolean {
  if (!filePath) return false;
  if (filePath.includes("..")) return false;
  if (filePath.includes("\\")) return false;
  if (path.isAbsolute(filePath)) return false;
  return true;
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.+/g, ".");
}
