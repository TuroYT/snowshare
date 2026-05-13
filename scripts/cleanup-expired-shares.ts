#!/usr/bin/env node
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

// Get upload directory from env or default to ./uploads
function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function getTusTempDir(): string {
  return path.join(getUploadDir(), ".tus-temp");
}

// Files in .tus-temp/ older than this are considered abandoned uploads.
const TUS_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Files in uploads/ without a DB record are only deleted after this grace
// period to avoid racing with in-flight uploads that have not yet inserted
// their database row.
const ORPHAN_GRACE_MS = 60 * 60 * 1000; // 1 hour

async function cleanupExpiredShares(): Promise<{ deletedShares: number; deletedFiles: number }> {
  console.log("🧹 Cleaning expired shares...");

  const now = new Date();

  const expiredShares = await prisma.share.findMany({
    where: { expiresAt: { lt: now } },
    select: {
      id: true,
      type: true,
      filePath: true,
      slug: true,
      isBulk: true,
      files: { select: { filePath: true } },
    },
  });

  console.log(`📊 ${expiredShares.length} expired share(s) found`);

  if (expiredShares.length === 0) {
    return { deletedShares: 0, deletedFiles: 0 };
  }

  let deletedFiles = 0;

  const deleteFileIfExists = async (relativePath: string, shareSlug: string): Promise<void> => {
    const fullFilePath = path.join(getUploadDir(), relativePath);
    try {
      await fs.promises.unlink(fullFilePath);
      deletedFiles++;
      console.log(`🗑️  File deleted: ${relativePath} (share: ${shareSlug})`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`❌ Error deleting file ${relativePath}:`, error);
      }
    }
  };

  for (const share of expiredShares) {
    if (share.type !== "FILE") continue;
    if (share.isBulk && share.files.length > 0) {
      await Promise.all(share.files.map((file) => deleteFileIfExists(file.filePath, share.slug)));
    } else if (share.filePath) {
      await deleteFileIfExists(share.filePath, share.slug);
    }
  }

  const deleteResult = await prisma.share.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  console.log(
    `✅ Expired shares: ${deleteResult.count} DB record(s), ${deletedFiles} file(s) deleted`
  );

  return { deletedShares: deleteResult.count, deletedFiles };
}

async function cleanupAbandonedTusUploads(
  maxAgeMs: number = TUS_TEMP_MAX_AGE_MS
): Promise<{ deletedFiles: number }> {
  console.log("🧹 Cleaning abandoned tus uploads...");

  const tusTempDir = getTusTempDir();
  let entries: fs.Dirent[];

  try {
    entries = await fs.promises.readdir(tusTempDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("ℹ️  No .tus-temp directory, skipping");
      return { deletedFiles: 0 };
    }
    throw error;
  }

  const cutoff = Date.now() - maxAgeMs;
  let deletedFiles = 0;

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return;
      const fullPath = path.join(tusTempDir, entry.name);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.mtimeMs >= cutoff) return;
        await fs.promises.unlink(fullPath);
        deletedFiles++;
        console.log(`🗑️  Abandoned tus file deleted: ${entry.name}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`❌ Error deleting tus file ${entry.name}:`, error);
        }
      }
    })
  );

  console.log(`✅ Abandoned tus uploads: ${deletedFiles} file(s) deleted`);
  return { deletedFiles };
}

async function cleanupOrphanFiles(
  graceMs: number = ORPHAN_GRACE_MS
): Promise<{ deletedFiles: number }> {
  console.log("🧹 Cleaning orphan files in uploads/...");

  const uploadDir = getUploadDir();
  let entries: fs.Dirent[];

  try {
    entries = await fs.promises.readdir(uploadDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("ℹ️  No uploads directory, skipping");
      return { deletedFiles: 0 };
    }
    throw error;
  }

  const fileEntries = entries.filter((entry) => entry.isFile() && !entry.name.startsWith("."));

  if (fileEntries.length === 0) {
    return { deletedFiles: 0 };
  }

  const [shareRows, shareFileRows] = await Promise.all([
    prisma.share.findMany({
      where: { filePath: { not: null } },
      select: { filePath: true },
    }),
    prisma.shareFile.findMany({ select: { filePath: true } }),
  ]);

  const referenced = new Set<string>();
  for (const row of shareRows) {
    if (row.filePath) referenced.add(row.filePath);
  }
  for (const row of shareFileRows) {
    referenced.add(row.filePath);
  }

  const cutoff = Date.now() - graceMs;
  let deletedFiles = 0;

  await Promise.all(
    fileEntries.map(async (entry) => {
      if (referenced.has(entry.name)) return;
      const fullPath = path.join(uploadDir, entry.name);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.mtimeMs >= cutoff) return;
        await fs.promises.unlink(fullPath);
        deletedFiles++;
        console.log(`🗑️  Orphan file deleted: ${entry.name}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`❌ Error deleting orphan ${entry.name}:`, error);
        }
      }
    })
  );

  console.log(`✅ Orphan files: ${deletedFiles} file(s) deleted`);
  return { deletedFiles };
}

async function runCleanup(): Promise<void> {
  console.log("🚀 Starting full cleanup...");

  try {
    const expired = await cleanupExpiredShares();
    const abandoned = await cleanupAbandonedTusUploads();
    const orphans = await cleanupOrphanFiles();

    console.log("");
    console.log("📊 Summary:");
    console.log(`   - ${expired.deletedShares} expired share(s) removed from DB`);
    console.log(`   - ${expired.deletedFiles} expired share file(s) deleted`);
    console.log(`   - ${abandoned.deletedFiles} abandoned tus upload(s) deleted`);
    console.log(`   - ${orphans.deletedFiles} orphan file(s) deleted`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Execute the script if it is called directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("cleanup-expired-shares.ts") ||
    process.argv[1].endsWith("cleanup-expired-shares.js"));
if (isMain) {
  runCleanup()
    .then(async () => {
      console.log("🎉 Cleanup completed successfully");
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("💥 Cleanup failed:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { cleanupExpiredShares, cleanupAbandonedTusUploads, cleanupOrphanFiles, runCleanup };
export default cleanupExpiredShares;
