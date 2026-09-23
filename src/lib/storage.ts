import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, existsSync } from "fs";
import { stat, unlink } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { getUploadDir } from "@/lib/constants";
import { getSettingsCached } from "@/lib/settings";

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

  // Fall back to DB settings (cached)
  try {
    const settings = await getSettingsCached();
    if (!settings?.s3Enabled || !settings.s3Bucket) return null;

    return {
      bucket: settings.s3Bucket,
      region: settings.s3Region || "us-east-1",
      endpoint: settings.s3Endpoint ?? undefined,
      accessKeyId: settings.s3AccessKeyId ?? undefined,
      secretAccessKey: settings.s3SecretAccessKey ?? undefined,
    };
  } catch (error) {
    console.error("Storage: failed to read S3 settings, falling back to local storage:", error);
    return null;
  }
}

// One S3 client per configuration, reused across requests (keeps HTTP connections alive)
const globalForS3 = globalThis as unknown as {
  __snowshareS3Client?: { fingerprint: string; client: S3Client };
};

function getS3Client(config: S3Config): S3Client {
  const fingerprint = JSON.stringify(config);
  const cached = globalForS3.__snowshareS3Client;
  if (cached && cached.fingerprint === fingerprint) return cached.client;

  cached?.client.destroy();
  const client = new S3Client({
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
  globalForS3.__snowshareS3Client = { fingerprint, client };
  return client;
}

function isS3NotFound(error: unknown): boolean {
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    err?.name === "NotFound" || err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404
  );
}

export async function isS3Enabled(): Promise<boolean> {
  return (await getS3Config()) !== null;
}

/**
 * Upload a local file to S3 under the given key. No-op when S3 is disabled.
 * Uses multipart upload, so files larger than the 5 GB single-PUT limit work.
 */
export async function uploadToStorage(localPath: string, key: string): Promise<void> {
  const config = await getS3Config();
  if (!config) return;
  const upload = new Upload({
    client: getS3Client(config),
    params: {
      Bucket: config.bucket,
      Key: key,
      Body: createReadStream(localPath),
    },
  });
  await upload.done();
}

/** Returns true if the file exists (locally or in S3). */
export async function storageFileExists(key: string): Promise<boolean> {
  const config = await getS3Config();
  if (!config) return existsSync(path.join(getUploadDir(), key));
  try {
    await getS3Client(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch (error) {
    if (!isS3NotFound(error)) {
      console.error(`Storage: HEAD failed for ${key}:`, error);
    }
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
  const res = await getS3Client(config).send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key })
  );
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
  const res = await getS3Client(config).send(
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
  await getS3Client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/**
 * Deletes every stored file of a share: the single file (filePath) and all bulk files.
 * Returns the keys that could not be deleted (errors are logged).
 */
export async function deleteShareFiles(share: {
  filePath?: string | null;
  files?: { filePath: string }[];
}): Promise<string[]> {
  const keys = [
    ...(share.filePath ? [share.filePath] : []),
    ...(share.files ?? []).map((file) => file.filePath),
  ];
  const failed: string[] = [];

  // Sequential on purpose: bulk shares can hold thousands of files
  for (const key of keys) {
    try {
      await deleteFromStorage(key);
    } catch (error) {
      console.error(`Storage: failed to delete ${key}:`, error);
      failed.push(key);
    }
  }
  return failed;
}
