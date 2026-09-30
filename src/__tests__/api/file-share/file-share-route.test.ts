/**
 * @jest-environment node
 */

jest.mock("@/app/api/shares/(fileShare)/fileshare", () => ({
  getFileShare: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  getStorageFileSize: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: { share: { updateMany: jest.fn() } },
}));

jest.mock("@/lib/access-log", () => ({
  logShareAccess: jest.fn(),
}));

jest.mock("@/lib/file-response", () => ({
  streamStoredFile: jest.fn(),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

jest.mock("@/lib/share-access", () => ({
  ...jest.requireActual("@/lib/share-access"),
  consumeView: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/(shares)/f/[slug]/api/route";
import { getFileShare } from "@/app/api/shares/(fileShare)/fileshare";
import { getStorageFileSize } from "@/lib/storage";
import { consumeView } from "@/lib/share-access";
import { streamStoredFile } from "@/lib/file-response";
import { logShareAccess } from "@/lib/access-log";
import { ErrorCode } from "@/lib/api-errors";

const mockGetFileShare = getFileShare as jest.Mock;
const mockGetSize = getStorageFileSize as jest.Mock;
const mockConsumeView = consumeView as jest.Mock;
const mockStream = streamStoredFile as jest.Mock;
const mockLog = logShareAccess as jest.Mock;

const params = (slug = "my-slug") => ({ params: Promise.resolve({ slug }) });

function post(body: unknown, raw = false) {
  return new NextRequest("http://localhost/f/my-slug/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

function get(query = "") {
  return new NextRequest(`http://localhost/f/my-slug/api${query}`);
}

describe("file share API route", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-file-share-route";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockConsumeView.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST validation", () => {
    it("returns 400 when the slug is missing", async () => {
      const res = await POST(post({ action: "info" }), params(""));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const res = await POST(post("{not json", true), params());
      expect(res.status).toBe(400);
    });

    it("returns 400 when the action is missing", async () => {
      const res = await POST(post({}), params());
      expect(res.status).toBe(400);
    });

    it("returns 400 for an unknown action", async () => {
      const res = await POST(post({ action: "nope" }), params());
      expect(res.status).toBe(400);
    });

    it("returns 500 when the handler throws", async () => {
      mockGetFileShare.mockRejectedValue(new Error("boom"));
      const res = await POST(post({ action: "info" }), params());
      expect(res.status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("POST info", () => {
    it("returns an error when the share is not found", async () => {
      mockGetFileShare.mockResolvedValue({ errorCode: ErrorCode.SHARE_NOT_FOUND });
      const res = await POST(post({ action: "info" }), params());
      expect(res.status).toBe(404);
    });

    it("returns 429 with Retry-After when rate limited", async () => {
      mockGetFileShare.mockResolvedValue({
        errorCode: ErrorCode.TOO_MANY_REQUESTS,
        retryAfter: 30,
      });
      const res = await POST(post({ action: "info", password: "x" }), params());
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("30");
    });

    it("reports that a password is required", async () => {
      mockGetFileShare.mockResolvedValue({
        errorCode: ErrorCode.PASSWORD_REQUIRED,
        requiresPassword: true,
      });
      const res = await POST(post({ action: "info" }), params());
      const data = await res.json();
      expect(data).toEqual({
        filename: "api.file_protected",
        requiresPassword: true,
        isBulk: false,
      });
    });

    it("keeps the bulk flag on password-protected bulk shares", async () => {
      mockGetFileShare.mockResolvedValue({ requiresPassword: true, isBulk: true });
      const res = await POST(post({ action: "info" }), params());
      expect((await res.json()).isBulk).toBe(true);
    });

    it("returns file info with size and note", async () => {
      mockGetFileShare.mockResolvedValue({
        storageKey: "key",
        originalFilename: "a.txt",
        share: { note: "hello" },
      });
      mockGetSize.mockResolvedValue(42);
      const res = await POST(post({ action: "info" }), params());
      expect(await res.json()).toEqual({
        filename: "a.txt",
        fileSize: 42,
        requiresPassword: false,
        isBulk: false,
        note: "hello",
      });
    });

    it("returns a null note when the share has none", async () => {
      mockGetFileShare.mockResolvedValue({ storageKey: "key", originalFilename: "a.txt" });
      mockGetSize.mockResolvedValue(1);
      const res = await POST(post({ action: "info" }), params());
      expect((await res.json()).note).toBeNull();
    });

    it("returns 404 when there is no storage key", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" } });
      const res = await POST(post({ action: "info" }), params());
      expect(res.status).toBe(404);
    });

    it("returns bulk info without an access token for unprotected shares", async () => {
      mockGetFileShare.mockResolvedValue({
        isBulk: true,
        share: {
          id: "s1",
          password: null,
          note: null,
          files: [
            { originalName: "a.txt", relativePath: "dir/a.txt", size: BigInt(10) },
            { originalName: "b.txt", relativePath: null, size: BigInt(5) },
          ],
        },
      });
      const res = await POST(post({ action: "info" }), params());
      const data = await res.json();
      expect(data.isBulk).toBe(true);
      expect(data.fileCount).toBe(2);
      expect(data.fileSize).toBe(15);
      expect(data.files).toEqual([
        { name: "a.txt", path: "dir/a.txt", size: 10 },
        { name: "b.txt", path: "b.txt", size: 5 },
      ]);
      expect(data.note).toBeNull();
      expect(data.accessToken).toBeUndefined();
    });

    it("returns an access token for password-protected bulk shares", async () => {
      mockGetFileShare.mockResolvedValue({
        isBulk: true,
        share: { id: "s1", password: "hash", note: "n", files: [] },
      });
      const res = await POST(post({ action: "info" }), params());
      const data = await res.json();
      expect(typeof data.accessToken).toBe("string");
      expect(data.fileCount).toBe(0);
      expect(data.note).toBe("n");
    });

    it("handles bulk shares without a files list", async () => {
      mockGetFileShare.mockResolvedValue({ isBulk: true, share: { id: "s1" } });
      const res = await POST(post({ action: "info" }), params());
      expect((await res.json()).fileCount).toBe(0);
    });
  });

  describe("POST download", () => {
    it("returns an error when access is denied", async () => {
      mockGetFileShare.mockResolvedValue({ errorCode: ErrorCode.SHARE_EXPIRED });
      const res = await POST(post({ action: "download" }), params());
      expect(res.status).toBe(410);
      expect(mockConsumeView).not.toHaveBeenCalled();
    });

    it("returns 404 when the share is missing", async () => {
      mockGetFileShare.mockResolvedValue({});
      const res = await POST(post({ action: "download" }), params());
      expect(res.status).toBe(404);
    });

    it("returns 404 for a single file without a storage key", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" }, isBulk: false });
      const res = await POST(post({ action: "download" }), params());
      expect(res.status).toBe(404);
    });

    it("fails when the view cannot be consumed (view limit reached)", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" }, storageKey: "k" });
      mockConsumeView.mockResolvedValue(false);
      const res = await POST(post({ action: "download" }), params());
      expect(res.status).toBe(410);
      expect(mockLog).not.toHaveBeenCalled();
    });

    it("consumes a view and returns a signed download URL", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" }, storageKey: "k" });
      const res = await POST(post({ action: "download", password: "pw" }), params());
      const data = await res.json();
      expect(mockGetFileShare).toHaveBeenCalledWith("my-slug", "pw", expect.anything());
      expect(mockConsumeView).toHaveBeenCalledWith("s1");
      expect(mockLog).toHaveBeenCalled();
      expect(data.isBulk).toBe(false);
      expect(data.downloadUrl).toBe(`/f/my-slug/download?token=${encodeURIComponent(data.token)}`);
      expect(data.tokenExpiresIn).toBeGreaterThan(0);
    });

    it("returns the bulk download URL for bulk shares", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s2" }, isBulk: true });
      const res = await POST(post({ action: "download" }), params());
      const data = await res.json();
      expect(data.isBulk).toBe(true);
      expect(data.downloadUrl).toContain("/f/my-slug/bulk-download?token=");
    });
  });

  describe("GET", () => {
    it("returns 400 when the slug is missing", async () => {
      const res = await GET(get(), params(""));
      expect(res.status).toBe(400);
    });

    it("redirects to the share page when a password is required and none given", async () => {
      mockGetFileShare.mockResolvedValue({
        errorCode: ErrorCode.PASSWORD_REQUIRED,
        requiresPassword: true,
      });
      const res = await GET(get(), params());
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost/f/my-slug");
    });

    it("returns an error when a wrong password is supplied", async () => {
      mockGetFileShare.mockResolvedValue({
        errorCode: ErrorCode.PASSWORD_INCORRECT,
        requiresPassword: true,
      });
      const res = await GET(get("?password=bad"), params());
      expect(res.status).toBe(400);
    });

    it("returns 404 when the storage key or share is missing", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" } });
      const res = await GET(get(), params());
      expect(res.status).toBe(404);
    });

    it("consumes a view and streams the file without a download token", async () => {
      mockGetFileShare.mockResolvedValue({
        share: { id: "s1" },
        storageKey: "k",
        originalFilename: "a.txt",
      });
      mockStream.mockResolvedValue(new Response("data"));
      const res = await GET(get("?password=pw&token=t"), params());
      expect(res.status).toBe(200);
      expect(mockGetFileShare).toHaveBeenCalledWith(
        "my-slug",
        "pw",
        expect.objectContaining({ token: "t" })
      );
      expect(mockConsumeView).toHaveBeenCalledWith("s1");
      expect(mockLog).toHaveBeenCalled();
      expect(mockStream).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ key: "k", filename: "a.txt" })
      );
    });

    it("falls back to a default filename", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" }, storageKey: "k" });
      mockStream.mockResolvedValue(new Response("data"));
      await GET(get(), params());
      expect(mockStream).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ filename: "download" })
      );
    });

    it("returns an error when the view limit is reached", async () => {
      mockGetFileShare.mockResolvedValue({ share: { id: "s1" }, storageKey: "k" });
      mockConsumeView.mockResolvedValue(false);
      const res = await GET(get(), params());
      expect(res.status).toBe(410);
      expect(mockStream).not.toHaveBeenCalled();
    });

    it("does not consume a view for a pre-counted download token", async () => {
      mockGetFileShare.mockResolvedValue({
        share: { id: "s1" },
        storageKey: "k",
        originalFilename: "a.txt",
        tokenPurpose: "download",
      });
      mockStream.mockResolvedValue(new Response("data"));
      const res = await GET(get("?token=abc"), params());
      expect(res.status).toBe(200);
      expect(mockConsumeView).not.toHaveBeenCalled();
      expect(mockLog).not.toHaveBeenCalled();
    });

    it("returns 500 when streaming throws", async () => {
      mockGetFileShare.mockRejectedValue(new Error("boom"));
      const res = await GET(get(), params());
      expect(res.status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
