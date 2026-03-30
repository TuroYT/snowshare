/**
 * @jest-environment node
 */

/**
 * Tests for file download streaming functionality
 */

// Mock external dependencies before imports
jest.mock("@/app/api/shares/(fileShare)/fileshare", () => ({
  getFileShare: jest.fn(),
}));

jest.mock("fs", () => ({
  createReadStream: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  stat: jest.fn(),
}));

jest.mock("@/lib/mime-types", () => ({
  getMimeType: jest.fn(() => "application/octet-stream"),
  isSafeForInline: jest.fn(() => false),
  sanitizeFilenameForHeader: jest.fn((name: string) => name),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextRequest } from "next/server";

const mockGetFileShare = getFileShare as jest.Mock;
const mockCreateReadStream = createReadStream as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;
const mockStat = stat as jest.Mock;

function makeRequest(headers: Record<string, string> = {}, slug = "test-slug"): NextRequest {
  return {
    url: `http://localhost:3000/api/download/${slug}`,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    nextUrl: {
      searchParams: { get: () => null },
    },
    cookies: { get: () => null },
  } as unknown as NextRequest;
}

describe("File Download Streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockStat.mockResolvedValue({ size: 1000000 });
    mockGetFileShare.mockResolvedValue({
      filePath: "/uploads/share-123_file.txt",
      originalFilename: "file.txt",
    });

    const mockStream = new Readable({
      read() {
        this.push("data");
        this.push(null);
      },
    });
    mockCreateReadStream.mockReturnValue(mockStream);
  });

  it("should use streaming (createReadStream) instead of loading the entire file into memory", async () => {
    const { GET } = await import("@/app/api/download/[slug]/route");
    const request = makeRequest({}, "test-slug");

    await GET(request, { params: Promise.resolve({ slug: "test-slug" }) });

    expect(mockCreateReadStream).toHaveBeenCalledWith("/uploads/share-123_file.txt");
    expect(mockCreateReadStream).toHaveBeenCalledTimes(1);
  });

  it("should support range requests for resumable downloads", async () => {
    const fileSize = 10000000;
    mockStat.mockResolvedValue({ size: fileSize });
    mockGetFileShare.mockResolvedValue({
      filePath: "/uploads/share-456_large.bin",
      originalFilename: "large.bin",
    });

    const { GET } = await import("@/app/api/download/[slug]/route");
    const request = makeRequest({ range: "bytes=0-999999" }, "large-file-slug");

    await GET(request, { params: Promise.resolve({ slug: "large-file-slug" }) });

    expect(mockCreateReadStream).toHaveBeenCalledWith(
      "/uploads/share-456_large.bin",
      expect.objectContaining({ start: 0, end: 999999 })
    );
  });

  it("should return 404 when the share does not exist", async () => {
    const { ErrorCode } = await import("@/lib/api-errors");
    mockGetFileShare.mockResolvedValue({ errorCode: ErrorCode.SHARE_NOT_FOUND });

    const { GET } = await import("@/app/api/download/[slug]/route");
    const request = makeRequest({}, "missing-slug");
    const response = await GET(request, { params: Promise.resolve({ slug: "missing-slug" }) });

    expect(response.status).toBe(404);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it("should return 416 for an invalid range header", async () => {
    // Range header beyond file size
    mockStat.mockResolvedValue({ size: 100 });

    const { GET } = await import("@/app/api/download/[slug]/route");
    const request = makeRequest({ range: "bytes=500-999" }, "test-slug");

    const response = await GET(request, { params: Promise.resolve({ slug: "test-slug" }) });

    expect(response.status).toBe(416);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it("should confirm createReadStream is available as a streaming API", () => {
    expect(mockCreateReadStream).toBeDefined();
    expect(typeof mockCreateReadStream).toBe("function");
  });
});
