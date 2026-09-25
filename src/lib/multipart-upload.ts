import Busboy from "busboy";
import crypto from "crypto";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { Readable, Transform, type TransformCallback } from "stream";
import { pipeline } from "stream/promises";
import type { NextRequest } from "next/server";

/**
 * Streaming multipart/form-data receiver: every file part is written straight to a
 * temporary file on disk, so request bodies are never buffered in memory.
 */

export interface ReceivedFile {
  /** Form field name of the file part */
  fieldName: string;
  /** Client-supplied filename (validated: no path separators, <= 255 chars) */
  filename: string;
  mimeType: string;
  /** Absolute path of the temporary file */
  tempPath: string;
  size: number;
}

export interface ReceiveMultipartOptions {
  /** Directory for temporary files (must be on the same device as final storage for rename) */
  tempDir: string;
  /** Maximum size of a single file */
  maxFileBytes: number;
  /** Maximum cumulated size of all files */
  maxTotalBytes: number;
  /** Maximum number of files */
  maxFiles: number;
  /** Only file parts whose field name passes this filter are kept (others are drained) */
  acceptFile?: (fieldName: string) => boolean;
}

export type MultipartErrorKind =
  "FILE_TOO_LARGE" | "TOTAL_TOO_LARGE" | "TOO_MANY_FILES" | "INVALID_FILENAME" | "MALFORMED";

export class MultipartError extends Error {
  constructor(
    public readonly kind: MultipartErrorKind,
    options?: { cause?: unknown }
  ) {
    super(`Multipart upload rejected: ${kind}`, options);
    this.name = "MultipartError";
  }
}

export function isValidUploadFilename(filename: string): boolean {
  return (
    !!filename &&
    filename.length <= 255 &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
}

/** Deletes temporary files, logging (not throwing) on failure. */
export async function removeTempFiles(files: Pick<ReceivedFile, "tempPath">[]): Promise<void> {
  await Promise.all(
    files.map((file) =>
      unlink(file.tempPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          console.error(`Multipart: failed to remove temp file ${file.tempPath}:`, error);
        }
      })
    )
  );
}

/**
 * Parses a multipart request, streaming files to disk while enforcing limits.
 * On any error every temporary file already written is removed.
 */
export async function receiveMultipart(
  request: NextRequest,
  options: ReceiveMultipartOptions
): Promise<{ fields: Record<string, string>; files: ReceivedFile[] }> {
  if (!request.body) throw new MultipartError("MALFORMED");

  const fields: Record<string, string> = {};
  const files: ReceivedFile[] = [];
  const writes: Promise<void>[] = [];
  let totalBytes = 0;
  let failure: MultipartError | null = null;

  let busboy: Busboy.Busboy;
  try {
    busboy = Busboy({
      headers: Object.fromEntries(request.headers),
      limits: { files: options.maxFiles + 1, fieldSize: 1024 * 1024 },
    });
  } catch (error) {
    throw new MultipartError("MALFORMED", { cause: error });
  }

  const source = Readable.fromWeb(request.body as unknown as import("stream/web").ReadableStream);

  // Settles the parsing promise once a failure is recorded (see the promise below)
  let settleOnFailure: () => void = () => {};

  const fail = (error: MultipartError) => {
    if (!failure) failure = error;
    // Stop reading the request: nothing more will be stored
    source.unpipe(busboy);
    source.resume();
    // Busboy never emits "close" after a file stream is destroyed. If the body was already
    // fully read, "end" has fired before the failure was known: settle right away.
    if (source.readableEnded) settleOnFailure();
  };

  busboy.on("field", (name, value) => {
    fields[name] = value;
  });

  busboy.on("file", (fieldName, stream, info) => {
    if (failure || (options.acceptFile && !options.acceptFile(fieldName)) || !info.filename) {
      stream.resume();
      return;
    }
    if (!isValidUploadFilename(info.filename)) {
      stream.resume();
      fail(new MultipartError("INVALID_FILENAME"));
      return;
    }
    if (files.length >= options.maxFiles) {
      stream.resume();
      fail(new MultipartError("TOO_MANY_FILES"));
      return;
    }

    const file: ReceivedFile = {
      fieldName,
      filename: info.filename,
      mimeType: info.mimeType || "application/octet-stream",
      tempPath: path.join(options.tempDir, `temp_${crypto.randomBytes(16).toString("hex")}`),
      size: 0,
    };
    files.push(file);

    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback: TransformCallback) {
        file.size += chunk.length;
        totalBytes += chunk.length;
        if (file.size > options.maxFileBytes) {
          callback(new MultipartError("FILE_TOO_LARGE"));
        } else if (totalBytes > options.maxTotalBytes) {
          callback(new MultipartError("TOTAL_TOO_LARGE"));
        } else {
          callback(null, chunk);
        }
      },
    });

    writes.push(
      pipeline(stream, limiter, createWriteStream(file.tempPath)).catch((error) => {
        stream.resume();
        fail(
          error instanceof MultipartError
            ? error
            : new MultipartError("MALFORMED", { cause: error })
        );
      })
    );
  });

  try {
    await new Promise<void>((resolve, reject) => {
      settleOnFailure = resolve;
      busboy.on("close", resolve);
      busboy.on("error", (error) => reject(new MultipartError("MALFORMED", { cause: error })));
      source.on("error", (error) => reject(new MultipartError("MALFORMED", { cause: error })));
      source.on("end", () => {
        // When parsing was aborted busboy never closes: finish once the body is drained
        if (failure) resolve();
      });
      source.pipe(busboy);
    });
    await Promise.all(writes);
  } catch (error) {
    await removeTempFiles(files);
    throw error instanceof MultipartError
      ? error
      : new MultipartError("MALFORMED", { cause: error });
  }

  if (failure) {
    await removeTempFiles(files);
    throw failure;
  }

  return { fields, files };
}
