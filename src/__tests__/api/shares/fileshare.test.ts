/**
 * @jest-environment node
 */

/**
 * Tests for file share retrieval functionality (getFileShare)
 * Note: File share creation is handled by the tus upload server (server.js),
 * not via a createFileShare() function.
 */

// Mock external dependencies before imports
jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findUnique: jest.fn(),
    },
    shareFile: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed_${password}`)
  ),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
}));

import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { existsSync } from "fs";
import { ErrorCode } from "@/lib/api-errors";

const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockShareFileFindMany = prisma.shareFile.findMany as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;

const baseShare = {
  id: "share-123",
  slug: "my-share",
  type: "FILE" as const,
  filePath: "share-123_document.pdf",
  password: null,
  expiresAt: null,
  isBulk: false,
  maxViews: null,
  viewCount: 0,
};

describe("getFileShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockPrismaFindUnique.mockResolvedValue(baseShare);
  });

  describe("share retrieval", () => {
    it("should return SHARE_NOT_FOUND for a non-existent share", async () => {
      mockPrismaFindUnique.mockResolvedValue(null);
      const result = await getFileShare("non-existent");
      expect(result.errorCode).toBe(ErrorCode.SHARE_NOT_FOUND);
    });

    it("should return SHARE_NOT_FOUND for a non-FILE share type", async () => {
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, type: "URL" });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBe(ErrorCode.SHARE_NOT_FOUND);
    });

    it("should return SHARE_EXPIRED for an expired share", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...baseShare,
        expiresAt: new Date(Date.now() - 86400000),
      });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBe(ErrorCode.SHARE_EXPIRED);
    });

    it("should return SHARE_EXPIRED when view count reaches maxViews", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...baseShare,
        maxViews: 5,
        viewCount: 5,
      });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBe(ErrorCode.SHARE_EXPIRED);
    });

    it("should allow access when view count is below maxViews", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...baseShare,
        maxViews: 10,
        viewCount: 3,
      });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe("password protection", () => {
    it("should return PASSWORD_REQUIRED for a password-protected share with no password", async () => {
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, password: "hashed_secret" });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_REQUIRED);
      expect(result.requiresPassword).toBe(true);
    });

    it("should return PASSWORD_INCORRECT for a wrong password", async () => {
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, password: "hashed_correct" });
      mockBcryptCompare.mockResolvedValueOnce(false);
      const result = await getFileShare("my-share", "wrong");
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INCORRECT);
    });

    it("should grant access for the correct password", async () => {
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, password: "hashed_secret" });
      mockBcryptCompare.mockResolvedValueOnce(true);
      const result = await getFileShare("my-share", "secret");
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe("file existence", () => {
    it("should return FILE_NOT_FOUND if filePath is null", async () => {
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, filePath: null });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it("should return FILE_NOT_FOUND if the physical file does not exist on disk", async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBe(ErrorCode.FILE_NOT_FOUND);
    });
  });

  describe("successful retrieval", () => {
    it("should return share data, filePath, and originalFilename", async () => {
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toMatchObject({ id: "share-123", slug: "my-share" });
      expect(result.filePath).toContain("uploads");
      expect(result.originalFilename).toBe("document.pdf");
    });

    it("should extract the original filename by stripping the share ID prefix", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...baseShare,
        filePath: "abc123_my-file_with_underscores.zip",
      });
      const result = await getFileShare("my-share");
      expect(result.originalFilename).toBe("my-file_with_underscores.zip");
    });

    it("should return share for a non-expired share", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...baseShare,
        expiresAt: new Date(Date.now() + 86400000),
      });
      const result = await getFileShare("my-share");
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe("bulk share", () => {
    it("should return share and files list for a bulk share", async () => {
      const files = [
        { originalName: "file1.txt", relativePath: "file1.txt", size: 100 },
        { originalName: "file2.txt", relativePath: "file2.txt", size: 200 },
      ];
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, isBulk: true, filePath: null });
      mockShareFileFindMany.mockResolvedValue(files);

      const result = await getFileShare("my-share");
      expect(result.errorCode).toBeUndefined();
      expect(result.isBulk).toBe(true);
      expect(result.share).toBeDefined();
      if (!result.share || !("files" in result.share)) {
        throw new Error("Expected bulk share files to be present");
      }
      expect(result.share.files).toHaveLength(2);
    });

    it("should not check filePath for bulk shares", async () => {
      mockPrismaFindUnique.mockResolvedValue({ ...baseShare, isBulk: true, filePath: null });
      mockShareFileFindMany.mockResolvedValue([]);

      const result = await getFileShare("my-share");
      // Should not return FILE_NOT_FOUND even with null filePath
      expect(result.errorCode).toBeUndefined();
    });
  });
});
