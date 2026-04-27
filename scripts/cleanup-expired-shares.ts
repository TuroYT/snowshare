#!/usr/bin/env node
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

// Get upload directory from env or default to ./uploads
function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

async function cleanupExpiredShares() {
  console.log("🧹 Starting cleanup of expired shares...");

  try {
    const now = new Date();

    const expiredShares = await prisma.share.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        type: true,
        filePath: true,
        slug: true,
        createdAt: true,
        expiresAt: true,
        isBulk: true,
        files: {
          select: {
            filePath: true,
          },
        },
      },
    });

    console.log(`📊 ${expiredShares.length} expired share(s) found`);

    if (expiredShares.length === 0) {
      console.log("✨ No expired shares to clean up");
      return;
    }

    let deletedFiles = 0;
    let deletedShares = 0;

    const deleteFileIfExists = async (
      relativePath: string,
      shareSlug: string
    ): Promise<boolean> => {
      const fullFilePath = path.join(getUploadDir(), relativePath);

      try {
        await fs.promises.access(fullFilePath, fs.constants.F_OK);
        await fs.promises.unlink(fullFilePath);
        deletedFiles++;
        console.log(`🗑️  File deleted: ${relativePath} (share: ${shareSlug})`);
        return true;
      } catch (error) {
        // Access throws if the file does not exist; ignore ENOENT but surface other errors for visibility.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`❌ Error deleting file ${relativePath}:`, error);
        }
        return false;
      }
    };

    for (const share of expiredShares) {
      if (share.type === "FILE") {
        if (share.isBulk && share.files) {
          const bulkDeletionTasks = share.files.map((file) =>
            deleteFileIfExists(file.filePath, share.slug)
          );
          await Promise.all(bulkDeletionTasks);
        } else if (share.filePath) {
          await deleteFileIfExists(share.filePath, share.slug);
        }
      }
    }

    // Delete database records
    const deleteResult = await prisma.share.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    deletedShares = deleteResult.count;

    console.log(`✅ Cleanup completed:`);
    console.log(`   - ${deletedShares} share(s) deleted from the database`);
    console.log(`   - ${deletedFiles} physical file(s) deleted`);
  } catch (error) {
    console.error("❌ Error during cleanup of expired shares:", error);
    process.exit(1);
  }
}

// Execute the script if it is called directly
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("cleanup-expired-shares.ts") ||
    process.argv[1].endsWith("cleanup-expired-shares.js"));
if (isMain) {
  cleanupExpiredShares()
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

export default cleanupExpiredShares;
