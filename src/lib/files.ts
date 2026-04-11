import path from "path";

/**
 * Generate a safe filename for storing an uploaded file on disk.
 * Format: {shareId}_{sanitized_basename}{ext}
 * Sanitizes the base name to prevent path traversal and filesystem issues.
 */
export function generateSafeFilename(originalName: string, shareId: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${shareId}_${baseName}${ext}`;
}
