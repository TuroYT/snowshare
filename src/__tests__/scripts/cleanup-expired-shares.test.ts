/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    shareFile: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  cleanupExpiredShares,
  cleanupAbandonedTusUploads,
  cleanupOrphanFiles,
} from "../../../scripts/cleanup-expired-shares";

const mockShareFindMany = prisma.share.findMany as jest.Mock;
const mockShareDeleteMany = prisma.share.deleteMany as jest.Mock;
const mockShareFileFindMany = prisma.shareFile.findMany as jest.Mock;

let tempUploadDir: string;
let originalUploadDir: string | undefined;

// Set mtime in the past so the file looks "old" enough to be cleaned.
function ageFile(filePath: string, ageMs: number): void {
  const past = new Date(Date.now() - ageMs);
  fs.utimesSync(filePath, past, past);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});

  tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowshare-cleanup-test-"));
  originalUploadDir = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = tempUploadDir;

  mockShareFindMany.mockResolvedValue([]);
  mockShareDeleteMany.mockResolvedValue({ count: 0 });
  mockShareFileFindMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalUploadDir === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = originalUploadDir;
  }
  fs.rmSync(tempUploadDir, { recursive: true, force: true });
});

describe("cleanupExpiredShares", () => {
  it("deletes physical files for expired single-file shares", async () => {
    const fileName = "share-1_doc.pdf";
    const filePath = path.join(tempUploadDir, fileName);
    fs.writeFileSync(filePath, "content");

    mockShareFindMany.mockResolvedValue([
      {
        id: "share-1",
        type: "FILE",
        filePath: fileName,
        slug: "my-share",
        isBulk: false,
        files: [],
      },
    ]);
    mockShareDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupExpiredShares();

    expect(result).toEqual({ deletedShares: 1, deletedFiles: 1 });
    expect(fs.existsSync(filePath)).toBe(false);
    expect(mockShareDeleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it("deletes all files for expired bulk shares", async () => {
    const file1 = "share-2_a.txt";
    const file2 = "share-2_b.txt";
    fs.writeFileSync(path.join(tempUploadDir, file1), "a");
    fs.writeFileSync(path.join(tempUploadDir, file2), "b");

    mockShareFindMany.mockResolvedValue([
      {
        id: "share-2",
        type: "FILE",
        filePath: null,
        slug: "bulk-share",
        isBulk: true,
        files: [{ filePath: file1 }, { filePath: file2 }],
      },
    ]);
    mockShareDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupExpiredShares();

    expect(result.deletedFiles).toBe(2);
    expect(fs.existsSync(path.join(tempUploadDir, file1))).toBe(false);
    expect(fs.existsSync(path.join(tempUploadDir, file2))).toBe(false);
  });

  it("ignores expired non-FILE shares but still deletes DB records", async () => {
    mockShareFindMany.mockResolvedValue([
      {
        id: "share-3",
        type: "URL",
        filePath: null,
        slug: "link-share",
        isBulk: false,
        files: [],
      },
    ]);
    mockShareDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupExpiredShares();

    expect(result).toEqual({ deletedShares: 1, deletedFiles: 0 });
  });

  it("returns zero counts when no shares are expired", async () => {
    const result = await cleanupExpiredShares();

    expect(result).toEqual({ deletedShares: 0, deletedFiles: 0 });
    expect(mockShareDeleteMany).not.toHaveBeenCalled();
  });

  it("handles missing files gracefully (ENOENT)", async () => {
    mockShareFindMany.mockResolvedValue([
      {
        id: "share-4",
        type: "FILE",
        filePath: "does-not-exist.bin",
        slug: "missing",
        isBulk: false,
        files: [],
      },
    ]);
    mockShareDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupExpiredShares();

    expect(result).toEqual({ deletedShares: 1, deletedFiles: 0 });
  });
});

describe("cleanupAbandonedTusUploads", () => {
  it("deletes tus-temp files older than the max age", async () => {
    const tusDir = path.join(tempUploadDir, ".tus-temp");
    fs.mkdirSync(tusDir);

    const oldFile = path.join(tusDir, "abandoned-upload-id");
    const oldMeta = path.join(tusDir, "abandoned-upload-id.json");
    fs.writeFileSync(oldFile, "partial data");
    fs.writeFileSync(oldMeta, "{}");
    ageFile(oldFile, 25 * 60 * 60 * 1000);
    ageFile(oldMeta, 25 * 60 * 60 * 1000);

    const result = await cleanupAbandonedTusUploads();

    expect(result.deletedFiles).toBe(2);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(oldMeta)).toBe(false);
  });

  it("preserves tus-temp files newer than the max age (in-flight uploads)", async () => {
    const tusDir = path.join(tempUploadDir, ".tus-temp");
    fs.mkdirSync(tusDir);

    const recentFile = path.join(tusDir, "in-flight-upload-id");
    fs.writeFileSync(recentFile, "partial data");

    const result = await cleanupAbandonedTusUploads();

    expect(result.deletedFiles).toBe(0);
    expect(fs.existsSync(recentFile)).toBe(true);
  });

  it("returns zero when .tus-temp does not exist", async () => {
    const result = await cleanupAbandonedTusUploads();

    expect(result).toEqual({ deletedFiles: 0 });
  });

  it("respects the maxAgeMs argument", async () => {
    const tusDir = path.join(tempUploadDir, ".tus-temp");
    fs.mkdirSync(tusDir);

    const file = path.join(tusDir, "upload-id");
    fs.writeFileSync(file, "data");
    ageFile(file, 2000); // 2 seconds old

    const result = await cleanupAbandonedTusUploads(1000); // 1 second threshold

    expect(result.deletedFiles).toBe(1);
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe("cleanupOrphanFiles", () => {
  it("deletes old files in uploads/ with no DB record", async () => {
    const orphan = path.join(tempUploadDir, "share-99_orphan.bin");
    fs.writeFileSync(orphan, "stale data");
    ageFile(orphan, 2 * 60 * 60 * 1000); // 2 hours old

    const result = await cleanupOrphanFiles();

    expect(result.deletedFiles).toBe(1);
    expect(fs.existsSync(orphan)).toBe(false);
  });

  it("preserves files that have a Share.filePath reference", async () => {
    const referenced = path.join(tempUploadDir, "share-1_keep.bin");
    fs.writeFileSync(referenced, "real data");
    ageFile(referenced, 2 * 60 * 60 * 1000);

    mockShareFindMany.mockResolvedValue([{ filePath: "share-1_keep.bin" }]);

    const result = await cleanupOrphanFiles();

    expect(result.deletedFiles).toBe(0);
    expect(fs.existsSync(referenced)).toBe(true);
  });

  it("preserves files that have a ShareFile.filePath reference", async () => {
    const referenced = path.join(tempUploadDir, "share-2_bulk.bin");
    fs.writeFileSync(referenced, "bulk data");
    ageFile(referenced, 2 * 60 * 60 * 1000);

    mockShareFileFindMany.mockResolvedValue([{ filePath: "share-2_bulk.bin" }]);

    const result = await cleanupOrphanFiles();

    expect(result.deletedFiles).toBe(0);
    expect(fs.existsSync(referenced)).toBe(true);
  });

  it("preserves recent orphans (grace period for in-flight uploads)", async () => {
    const recent = path.join(tempUploadDir, "share-3_new.bin");
    fs.writeFileSync(recent, "just uploaded");

    const result = await cleanupOrphanFiles();

    expect(result.deletedFiles).toBe(0);
    expect(fs.existsSync(recent)).toBe(true);
  });

  it("skips dotfiles and subdirectories like .tus-temp/", async () => {
    fs.mkdirSync(path.join(tempUploadDir, ".tus-temp"));
    fs.writeFileSync(path.join(tempUploadDir, ".tus-temp", "in-progress"), "data");

    const dotfile = path.join(tempUploadDir, ".hidden");
    fs.writeFileSync(dotfile, "x");
    ageFile(dotfile, 2 * 60 * 60 * 1000);

    const result = await cleanupOrphanFiles();

    expect(result.deletedFiles).toBe(0);
    expect(fs.existsSync(dotfile)).toBe(true);
  });

  it("returns zero when uploads/ does not exist", async () => {
    fs.rmSync(tempUploadDir, { recursive: true, force: true });

    const result = await cleanupOrphanFiles();

    expect(result).toEqual({ deletedFiles: 0 });

    // Recreate so afterEach cleanup does not fail
    fs.mkdirSync(tempUploadDir);
  });
});
