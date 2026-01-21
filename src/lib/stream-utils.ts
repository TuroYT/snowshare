import { Readable } from 'stream';

/**
 * Helper to convert Node.js stream to Web Stream for Next.js
 * This allows streaming files without loading them entirely into memory
 */
export function nodeStreamToWebStream(nodeStream: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    }
  });
}

/**
 * Parse and validate Range header for HTTP range requests
 * @param rangeHeader - The Range header value (e.g., "bytes=0-999")
 * @param fileSize - The total size of the file
 * @returns Object with start and end positions, or null if invalid
 */
export function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  // Parse range header
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  
  if (parts.length !== 2) {
    return null;
  }

  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  // Validate parsed values
  if (isNaN(start) || isNaN(end)) {
    return null;
  }

  // Check for negative values
  if (start < 0 || end < 0) {
    return null;
  }

  // Check that start is not greater than end
  if (start > end) {
    return null;
  }

  // Check that values are within file bounds
  if (start >= fileSize || end >= fileSize) {
    return null;
  }

  return { start, end };
}
