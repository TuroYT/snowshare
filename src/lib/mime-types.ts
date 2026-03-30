/**
 * Centralized MIME type mapping for file handling.
 * Used across download, preview, and upload routes.
 */

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
};

/**
 * MIME types that are considered safe for inline display.
 * SVG and HTML are explicitly excluded to prevent XSS.
 */
const SAFE_INLINE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/ogg",
]);

/**
 * Get MIME type from a file extension.
 */
export function getMimeType(filenameOrExt: string): string {
  const ext = filenameOrExt.startsWith(".")
    ? filenameOrExt.toLowerCase()
    : "." + filenameOrExt.split(".").pop()?.toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Check if a MIME type is safe for inline display (no XSS risk).
 * SVG and HTML are NOT safe for inline display.
 */
export function isSafeForInline(contentType: string): boolean {
  return SAFE_INLINE_TYPES.has(contentType);
}

/**
 * Sanitize a filename for use in Content-Disposition headers.
 * Prevents header injection attacks.
 */
export function sanitizeFilenameForHeader(filename: string): string {
  return (filename || "download")
    .replace(/[\r\n]/g, "")
    .replace(/["\\/]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_");
}
