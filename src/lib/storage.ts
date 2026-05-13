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
import { prisma } from "./prisma";

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

async function getS3Config(): Promise<S3Config | null> {
  // Env vars take priority — no DB query needed
  if (process.env.S3_BUCKET) {
    return {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
  }

  // Fall back to DB settings
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        s3Enabled: true,
        s3Bucket: true,
        s3Region: true,
        s3Endpoint: true,
        s3AccessKeyId: true,
        s3SecretAccessKey: true,
      },
    });

    if (!settings?.s3Enabled || !settings.s3Bucket) return null;

    return {
      bucket: settings.s3Bucket,
      region: settings.s3Region || "us-east-1",
      endpoint: settings.s3Endpoint ?? undefined,
      accessKeyId: settings.s3AccessKeyId ?? undefined,
      secretAccessKey: settings.s3SecretAccessKey ?? undefined,
    };
  } catch {
    return null;
  }
}

function buildS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint && { endpoint: config.endpoint }),
    ...(config.accessKeyId &&
      config.secretAccessKey && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    forcePathStyle: !!config.endpoint,
  });
}

export async function isS3Enabled(): Promise<boolean> {
  return (await getS3Config()) !== null;
}

/** Upload a local file to S3 under the given key. No-op when S3 is disabled. */
export async function uploadToStorage(localPath: string, key: string): Promise<void> {
  const config = await getS3Config();
  if (!config) return;
  const s3 = buildS3Client(config);
  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: createReadStream(localPath),
    })
  );
}

/** Returns true if the file exists (locally or in S3). */
export async function storageFileExists(key: string): Promise<boolean> {
  const config = await getS3Config();
  if (!config) return existsSync(path.join(getUploadDir(), key));
  try {
    const s3 = buildS3Client(config);
    await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Returns the byte size of a stored file. */
export async function getStorageFileSize(key: string): Promise<number> {
  const config = await getS3Config();
  if (!config) {
    const stats = await stat(path.join(getUploadDir(), key));
    return stats.size;
  }
  const s3 = buildS3Client(config);
  const res = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  return res.ContentLength ?? 0;
}

/** Returns a readable stream for a stored file, optionally with a byte range. */
export async function getStorageReadStream(
  key: string,
  range?: { start: number; end: number }
): Promise<Readable> {
  const config = await getS3Config();
  if (!config) {
    return createReadStream(path.join(getUploadDir(), key), range);
  }
  const s3 = buildS3Client(config);
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ...(range && { Range: `bytes=${range.start}-${range.end}` }),
    })
  );
  return res.Body as unknown as Readable;
}

/** Deletes a file from storage (local or S3). Silently ignores missing files. */
export async function deleteFromStorage(key: string): Promise<void> {
  const config = await getS3Config();
  if (!config) {
    try {
      await unlink(path.join(getUploadDir(), key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return;
  }
  const s3 = buildS3Client(config);
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
