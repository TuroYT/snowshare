import { Readable } from "stream";

/**
 * Convert a Node.js stream to a Web ReadableStream for Next.js responses.
 *
 * Pull-based: a chunk is read from the source only when the consumer asks for one, so a slow
 * client throttles disk/S3 reads instead of making the server buffer the whole file in memory.
 */
export function nodeStreamToWebStream(nodeStream: Readable): ReadableStream {
  let finished = false;
  let failure: Error | null = null;
  let wake: (() => void) | null = null;

  const notify = () => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };
  nodeStream.on("readable", notify);
  nodeStream.on("end", () => {
    finished = true;
    notify();
  });
  nodeStream.on("error", (error) => {
    failure = error;
    notify();
  });

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        if (failure) {
          controller.error(failure);
          return;
        }
        const chunk = nodeStream.read() as Buffer | string | null;
        if (chunk !== null) {
          controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          return;
        }
        if (finished) {
          controller.close();
          return;
        }
        // read() may have failed or ended the stream synchronously
        if (failure) continue;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * Parse and validate Range header for HTTP range requests
 * @param rangeHeader - The Range header value (e.g., "bytes=0-999")
 * @param fileSize - The total size of the file
 * @returns Object with start and end positions, or null if invalid
 */
export function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
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
  // Note: end can equal fileSize - 1 since byte positions are zero-indexed
  if (start >= fileSize || end > fileSize - 1) {
    return null;
  }

  return { start, end };
}
