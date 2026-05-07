import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createReadStream, existsSync } from "fs";
import { stat, unlink } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { getUploadDir } from "./constants";

let _s3: S3Client | null | undefined = undefined;

function getS3Client(): S3Client | null {
  if (_s3 !== undefined) return _s3;
  if (!process.env.S3_BUCKET) {
    _s3 = null;
    return null;
  }
  _s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
    ...(process.env.S3_ACCESS_KEY_ID && {
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    }),
    // Required for MinIO / path-style endpoints
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
  return _s3;
}

function bucket(): string {
  return process.env.S3_BUCKET!;
}

export function isS3Enabled(): boolean {
  return !!process.env.S3_BUCKET;
}

/** Upload a local file to S3 under the given key. No-op when S3 is disabled. */
export async function uploadToStorage(localPath: string, key: string): Promise<void> {
  const s3 = getS3Client();
  if (!s3) return;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: createReadStream(localPath),
    })
  );
}

/** Returns true if the file exists (locally or in S3). */
export async function storageFileExists(key: string): Promise<boolean> {
  const s3 = getS3Client();
  if (!s3) return existsSync(path.join(getUploadDir(), key));
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Returns the byte size of a stored file. */
export async function getStorageFileSize(key: string): Promise<number> {
  const s3 = getS3Client();
  if (!s3) {
    const stats = await stat(path.join(getUploadDir(), key));
    return stats.size;
  }
  const res = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  return res.ContentLength ?? 0;
}

/** Returns a readable stream for a stored file, optionally with a byte range. */
export async function getStorageReadStream(
  key: string,
  range?: { start: number; end: number }
): Promise<Readable> {
  const s3 = getS3Client();
  if (!s3) {
    return createReadStream(path.join(getUploadDir(), key), range);
  }
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ...(range && { Range: `bytes=${range.start}-${range.end}` }),
    })
  );
  // In Node.js, the AWS SDK returns a Node.js Readable stream
  return res.Body as unknown as Readable;
}

/** Deletes a file from storage (local or S3). Silently ignores missing files. */
export async function deleteFromStorage(key: string): Promise<void> {
  const s3 = getS3Client();
  if (!s3) {
    try {
      await unlink(path.join(getUploadDir(), key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return;
  }
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
