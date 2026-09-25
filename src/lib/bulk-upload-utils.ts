import path from "path";
import { Readable } from "stream";
import { ZipArchive } from "archiver";
import { getStorageReadStream } from "@/lib/storage";

// Formats that are already compressed: storing them avoids burning CPU for no gain
const ALREADY_COMPRESSED_EXTENSIONS = new Set([
  ".zip",
  ".gz",
  ".tgz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".zst",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".heic",
  ".mp4",
  ".mkv",
  ".webm",
  ".mov",
  ".avi",
  ".mp3",
  ".ogg",
  ".flac",
  ".aac",
  ".m4a",
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".odt",
  ".ods",
  ".epub",
  ".jar",
  ".apk",
]);

function isAlreadyCompressed(filename: string): boolean {
  return ALREADY_COMPRESSED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/**
 * Readable that opens the underlying storage stream only when first read.
 * The zip archiver consumes entries one at a time, so only one file (local descriptor
 * or S3 GET) is open at any moment, whatever the number of files in the share.
 */
function lazyStorageStream(key: string): Readable {
  let source: Readable | null = null;

  const lazy = new Readable({
    read() {
      if (source) {
        source.resume();
        return;
      }
      getStorageReadStream(key)
        .then((stream) => {
          source = stream;
          stream.on("data", (chunk) => {
            if (!lazy.push(chunk)) stream.pause();
          });
          stream.on("end", () => lazy.push(null));
          stream.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
              // Local file missing: same treatment as a failed S3 GET below
              console.error(`Zip archive: missing file ${key}, adding an empty entry`);
              lazy.push(null);
            } else {
              lazy.destroy(error);
            }
          });
        })
        .catch((error) => {
          // A missing file becomes an empty entry instead of breaking the whole archive
          console.error(`Zip archive: cannot open ${key}, adding an empty entry:`, error);
          lazy.push(null);
        });
    },
    destroy(error, callback) {
      source?.destroy();
      callback(error);
    },
  });

  return lazy;
}

export async function createZipStream(
  files: Array<{ filePath: string; originalName: string; relativePath: string }>
): Promise<Readable> {
  const archive = new ZipArchive({
    zlib: { level: 6 },
  });

  archive.on("warning", (warning) => {
    console.error("Zip archive warning:", warning);
  });

  for (const file of files) {
    const displayPath = file.relativePath || file.originalName;
    archive.append(lazyStorageStream(file.filePath), {
      name: displayPath,
      store: isAlreadyCompressed(displayPath),
    });
  }

  void archive.finalize();
  return archive;
}

export function validateFilePath(filePath: string): boolean {
  if (!filePath) return false;
  if (filePath.includes("..")) return false;
  if (filePath.includes("\\")) return false;
  if (path.isAbsolute(filePath)) return false;
  return true;
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.+/g, ".");
}
