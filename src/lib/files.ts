import crypto from "crypto";
import path from "path";

const MAX_BASENAME_LENGTH = 150;

/**
 * Generate a safe storage key for an uploaded file.
 * Format: {shareId}_{sanitized_basename}{ext}, or {shareId}_{random}_{sanitized_basename}{ext}
 * when `unique` is set (bulk shares may contain several files with the same name).
 * The base name is sanitized (no path separators or special characters) and truncated.
 */
export function generateSafeFilename(
  originalName: string,
  shareId: string,
  { unique = false }: { unique?: boolean } = {}
): string {
  const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, "_");
  const baseName = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, MAX_BASENAME_LENGTH);
  const prefix = unique ? `${shareId}_${crypto.randomBytes(8).toString("hex")}` : shareId;
  return `${prefix}_${baseName}${ext}`;
}
