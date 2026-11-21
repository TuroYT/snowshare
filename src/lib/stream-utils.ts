import { Readable } from "node:stream";

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

/** Parses a single `bytes=start-end` range; null when malformed or out of bounds. */
export function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const parts = rangeHeader.replace(/bytes=/, "").split("-");

  if (parts.length !== 2) {
    return null;
  }

  const start = Number.parseInt(parts[0], 10);
  const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  if (start < 0 || end < 0) {
    return null;
  }

  if (start > end) {
    return null;
  }

  // Byte positions are zero-indexed: the last valid one is fileSize - 1
  if (start >= fileSize || end > fileSize - 1) {
    return null;
  }

  return { start, end };
}
