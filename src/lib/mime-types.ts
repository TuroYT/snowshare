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

/** SVG and HTML are excluded on purpose: inline display would allow XSS. */
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

export function getMimeType(filenameOrExt: string): string {
  const ext = filenameOrExt.startsWith(".")
    ? filenameOrExt.toLowerCase()
    : "." + filenameOrExt.split(".").pop()?.toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export function isSafeForInline(contentType: string): boolean {
  return SAFE_INLINE_TYPES.has(contentType);
}

/** Strips characters that could inject headers through Content-Disposition. */
export function sanitizeFilenameForHeader(filename: string): string {
  return (filename || "download")
    .replace(/[\r\n]/g, "")
    .replace(/["\\/]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_");
}
