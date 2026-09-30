/**
 * @jest-environment node
 */

jest.mock("node:fs/promises", () => {
  const actual = jest.requireActual("node:fs/promises");
  return { ...actual, stat: jest.fn(actual.stat), unlink: jest.fn(actual.unlink) };
});
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/getClientIp", () => ({ getClientIp: jest.fn(() => "10.0.0.1") }));
jest.mock("@/lib/quota-shared", () => ({ getUploadLimits: jest.fn() }));
jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn() }));
jest.mock("@/lib/storage", () => ({
  isS3Enabled: jest.fn(async () => false),
  uploadToStorage: jest.fn(),
}));
jest.mock("@/lib/ip-geolocation", () => ({ lookupIpGeolocation: jest.fn() }));
jest.mock("@/lib/security", () => ({
  ...jest.requireActual("@/lib/security"),
  hashPassword: jest.fn(async (p: string) => `hashed:${p}`),
  generateRandomSlug: jest.fn(async () => "random-slug"),
}));
jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));
jest.mock("@/lib/multipart-upload", () => ({
  ...jest.requireActual("@/lib/multipart-upload"),
  receiveMultipart: jest.fn(),
}));

import fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { getUploadLimits } from "@/lib/quota-shared";
import { getSettingsCached } from "@/lib/settings";
import { ErrorCode } from "@/lib/api-errors";
import { MultipartError, receiveMultipart } from "@/lib/multipart-upload";
import { POST } from "@/app/api/upload/route";

const mockSession = getServerSession as jest.Mock;
const mockLimits = getUploadLimits as jest.Mock;
const mockSettings = getSettingsCached as jest.Mock;
const mockReceive = receiveMultipart as jest.Mock;
const mockFindUnique = prisma.share.findUnique as jest.Mock;
const mockCreate = prisma.share.create as jest.Mock;
const mockUpdate = prisma.share.update as jest.Mock;
const mockDelete = prisma.share.delete as jest.Mock;

const LIMITS = {
  maxFileSizeBytes: 100 * 1024 * 1024,
  maxFileSizeMB: 100,
  remainingQuotaBytes: 50 * 1024 * 1024,
  ipQuotaBytes: 200 * 1024 * 1024,
  ipQuotaMB: 200,
};

function makeRequest(headers: Record<string, string> = {}, withBody = true): NextRequest {
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: withBody ? "payload" : undefined,
    headers: { "content-type": "multipart/form-data; boundary=xyz", ...headers },
  });
}

describe("POST /api/upload", () => {
  let uploadsDir: string;
  let tempCounter = 0;
  let errorSpy: jest.SpyInstance;
  const originalUploadDir = process.env.UPLOAD_DIR;

  /** Makes receiveMultipart write a real temp file and report it as the received file */
  function receiveFile(
    content: string,
    fields: Record<string, string> = {},
    filename = "report.txt"
  ) {
    mockReceive.mockImplementationOnce(async (_req: NextRequest, options: { tempDir: string }) => {
      const tempPath = path.join(options.tempDir, `upload_tmp_${tempCounter++}`);
      fs.writeFileSync(tempPath, content);
      return {
        files: [
          {
            fieldName: "file",
            filename,
            mimeType: "text/plain",
            tempPath,
            size: Buffer.byteLength(content),
          },
        ],
        fields,
      };
    });
  }

  const sessionFiles = () => fs.readdirSync(uploadsDir).filter((f) => f.startsWith("temp_upload_"));

  beforeEach(() => {
    jest.clearAllMocks();
    mockReceive.mockReset();
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowshare-upload-route-"));
    process.env.UPLOAD_DIR = uploadsDir;
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockLimits.mockResolvedValue({ ...LIMITS });
    mockSettings.mockResolvedValue({ allowAnonFileShare: true });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "share-1",
      type: "FILE",
      expiresAt: data.expiresAt,
      password: data.password,
      slug: data.slug,
    }));
    mockUpdate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  });

  describe("request validation", () => {
    it("rejects a non-multipart content type", async () => {
      const res = await POST(makeRequest({ "content-type": "application/json" }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(ErrorCode.INVALID_REQUEST);
      expect(mockReceive).not.toHaveBeenCalled();
    });

    it("rejects a request without content type", async () => {
      const req = new NextRequest("http://localhost/api/upload", { method: "POST" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects a request without body", async () => {
      const res = await POST(makeRequest({}, false));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(ErrorCode.MISSING_DATA);
    });

    it.each([
      ["non-numeric index", { "x-chunk-index": "a", "x-total-chunks": "2", "x-upload-id": "abc" }],
      ["non-numeric total", { "x-chunk-index": "0", "x-total-chunks": "b", "x-upload-id": "abc" }],
      ["negative index", { "x-chunk-index": "-1", "x-total-chunks": "2", "x-upload-id": "abc" }],
      ["zero total", { "x-chunk-index": "0", "x-total-chunks": "0", "x-upload-id": "abc" }],
      ["index >= total", { "x-chunk-index": "2", "x-total-chunks": "2", "x-upload-id": "abc" }],
      ["bad upload id", { "x-chunk-index": "0", "x-total-chunks": "2", "x-upload-id": "a/../b" }],
      [
        "too long upload id",
        { "x-chunk-index": "0", "x-total-chunks": "2", "x-upload-id": "a".repeat(101) },
      ],
    ])("rejects invalid chunk info (%s)", async (_label, headers) => {
      const res = await POST(makeRequest(headers));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(ErrorCode.INVALID_REQUEST);
      expect(mockReceive).not.toHaveBeenCalled();
    });
  });

  describe("single request upload", () => {
    it("creates a share and moves the file to storage", async () => {
      receiveFile("hello world", { slug: "my-slug" });
      const res = await POST(makeRequest());
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.share).toMatchObject({
        slug: "my-slug",
        type: "FILE",
        filename: "report.txt",
        hasPassword: false,
      });
      const data = mockCreate.mock.calls[0][0].data;
      expect(data.size).toBe(BigInt(11));
      expect(data.ownerId).toBe("user-1");
      expect(data.ipSource).toBe("10.0.0.1");
      const filePath = mockUpdate.mock.calls[0][0].data.filePath as string;
      expect(mockUpdate.mock.calls[0][0].where).toEqual({ id: "share-1" });
      expect(fs.readFileSync(path.join(uploadsDir, filePath), "utf8")).toBe("hello world");
      expect(fs.readdirSync(uploadsDir)).toEqual([filePath]);
    });

    it("hashes the password and reports hasPassword", async () => {
      receiveFile("data", { password: "secret123" });
      const res = await POST(makeRequest());
      expect(res.status).toBe(201);
      expect((await res.json()).share.hasPassword).toBe(true);
      expect(mockCreate.mock.calls[0][0].data.password).toBe("hashed:secret123");
    });

    it("limits the received size using the file and quota limits", async () => {
      receiveFile("x");
      await POST(makeRequest());
      expect(mockReceive.mock.calls[0][1]).toMatchObject({
        tempDir: uploadsDir,
        maxFileBytes: LIMITS.maxFileSizeBytes,
        maxTotalBytes: LIMITS.remainingQuotaBytes,
        maxFiles: 1,
      });
      const accept = mockReceive.mock.calls[0][1].acceptFile as (name: string) => boolean;
      expect(accept("file")).toBe(true);
      expect(accept("other")).toBe(false);
    });

    it("works for anonymous users when allowed", async () => {
      mockSession.mockResolvedValue(null);
      receiveFile("anon");
      const res = await POST(makeRequest());
      expect(res.status).toBe(201);
      expect(mockCreate.mock.calls[0][0].data.ownerId).toBeNull();
      expect(mockCreate.mock.calls[0][0].data.expiresAt).toBeInstanceOf(Date);
    });

    it("rejects anonymous users when anonymous file sharing is disabled", async () => {
      mockSession.mockResolvedValue(null);
      mockSettings.mockResolvedValue({ allowAnonFileShare: false });
      const res = await POST(makeRequest());
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe(ErrorCode.ANON_FILE_SHARE_DISABLED);
      expect(mockReceive).not.toHaveBeenCalled();
    });

    it("rejects a new upload when the quota is exhausted", async () => {
      mockLimits.mockResolvedValue({ ...LIMITS, remainingQuotaBytes: 0 });
      const res = await POST(makeRequest());
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.code).toBe(ErrorCode.IP_QUOTA_EXCEEDED);
      expect(mockReceive).not.toHaveBeenCalled();
    });

    it("returns FILE_REQUIRED when no file was received", async () => {
      mockReceive.mockResolvedValueOnce({ files: [], fields: {} });
      const res = await POST(makeRequest());
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(ErrorCode.FILE_REQUIRED);
    });

    it("maps multipart size errors and removes the temp file", async () => {
      mockReceive.mockRejectedValueOnce(new MultipartError("FILE_TOO_LARGE"));
      const res = await POST(makeRequest());
      expect(res.status).toBe(413);
      expect((await res.json()).code).toBe(ErrorCode.FILE_TOO_LARGE);
    });

    it("returns an option validation error and cleans the temp file", async () => {
      receiveFile("data", { slug: "bad slug!" });
      const res = await POST(makeRequest());
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(ErrorCode.SLUG_INVALID);
      expect(fs.readdirSync(uploadsDir)).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rolls back the share and cleans up when the database update fails", async () => {
      receiveFile("data");
      mockUpdate.mockRejectedValueOnce(new Error("db failure"));
      const res = await POST(makeRequest());
      expect(res.status).toBe(500);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "share-1" } });
    });

    it("rolls back the share when moving to storage fails", async () => {
      receiveFile("data");
      mockCreate.mockImplementationOnce(async () => {
        // Remove the temp file so the rename in moveToStorage fails
        for (const f of fs.readdirSync(uploadsDir)) fs.rmSync(path.join(uploadsDir, f));
        return { id: "share-2", type: "FILE", slug: "s", expiresAt: null, password: null };
      });
      const res = await POST(makeRequest());
      expect(res.status).toBe(500);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "share-2" } });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("chunked upload", () => {
    const chunkHeaders = (index: number, total: number, id = "upload-1") => ({
      "x-chunk-index": String(index),
      "x-total-chunks": String(total),
      "x-upload-id": id,
    });

    it("stores intermediate chunks in a session file and finalizes on the last one", async () => {
      receiveFile("AAA");
      const first = await POST(makeRequest(chunkHeaders(0, 3)));
      expect(first.status).toBe(201);
      expect(await first.json()).toEqual({ status: "chunk_received", index: 0, nextIndex: 1 });
      expect(sessionFiles()).toHaveLength(1);

      receiveFile("BBB");
      const second = await POST(makeRequest(chunkHeaders(1, 3)));
      expect((await second.json()).nextIndex).toBe(2);
      // Remaining limits shrink by the bytes already received
      expect(mockReceive.mock.calls[1][1].maxFileBytes).toBe(LIMITS.maxFileSizeBytes - 3);
      expect(mockReceive.mock.calls[1][1].maxTotalBytes).toBe(LIMITS.remainingQuotaBytes - 3);

      receiveFile("CCC", { slug: "chunked" }, "big.bin");
      const last = await POST(makeRequest(chunkHeaders(2, 3)));
      expect(last.status).toBe(201);
      const body = await last.json();
      expect(body.share.slug).toBe("chunked");
      expect(body.share.filename).toBe("big.bin");
      expect(mockCreate.mock.calls[0][0].data.size).toBe(BigInt(9));

      const filePath = mockUpdate.mock.calls[0][0].data.filePath as string;
      expect(fs.readFileSync(path.join(uploadsDir, filePath), "utf8")).toBe("AAABBBCCC");
      expect(sessionFiles()).toHaveLength(0);
    });

    it("finalizes a single-chunk upload", async () => {
      receiveFile("only");
      const res = await POST(makeRequest(chunkHeaders(0, 1)));
      expect(res.status).toBe(201);
      expect((await res.json()).share.type).toBe("FILE");
      expect(sessionFiles()).toHaveLength(0);
    });

    it("truncates stale session content when restarting at chunk 0", async () => {
      receiveFile("OLD-OLD");
      await POST(makeRequest(chunkHeaders(0, 2)));
      receiveFile("NEW");
      await POST(makeRequest(chunkHeaders(0, 2)));
      receiveFile("!");
      const res = await POST(makeRequest(chunkHeaders(1, 2)));
      expect(res.status).toBe(201);
      const filePath = mockUpdate.mock.calls[0][0].data.filePath as string;
      expect(fs.readFileSync(path.join(uploadsDir, filePath), "utf8")).toBe("NEW!");
    });

    it("isolates sessions by uploader identity", async () => {
      receiveFile("AAA");
      await POST(makeRequest(chunkHeaders(0, 2)));
      mockSession.mockResolvedValue(null);
      receiveFile("BBB");
      await POST(makeRequest(chunkHeaders(0, 2)));
      expect(sessionFiles()).toHaveLength(2);
    });

    it("rejects a non-first chunk without an existing session", async () => {
      const res = await POST(makeRequest(chunkHeaders(1, 2)));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe(ErrorCode.INVALID_REQUEST);
      expect(mockReceive).not.toHaveBeenCalled();
    });

    it("allows later chunks even if the quota is now exhausted", async () => {
      receiveFile("AAA");
      await POST(makeRequest(chunkHeaders(0, 2)));
      mockLimits.mockResolvedValue({ ...LIMITS, remainingQuotaBytes: 0 });
      receiveFile("B");
      const res = await POST(makeRequest(chunkHeaders(1, 2)));
      expect(res.status).toBe(201);
      expect(mockReceive.mock.calls[1][1].maxTotalBytes).toBe(0);
    });

    it("removes the session file when finalization fails", async () => {
      receiveFile("AAA");
      await POST(makeRequest(chunkHeaders(0, 2)));
      expect(sessionFiles()).toHaveLength(1);
      receiveFile("BBB", { slug: "bad slug!" });
      const res = await POST(makeRequest(chunkHeaders(1, 2)));
      expect(res.status).toBe(400);
      expect(sessionFiles()).toHaveLength(0);
    });

    it("logs an error when the session file cannot be removed", async () => {
      receiveFile("AAA");
      await POST(makeRequest(chunkHeaders(0, 2)));
      const realUnlink = jest.requireActual("node:fs/promises").unlink;
      const unlinkSpy = (fsPromises.unlink as jest.Mock).mockImplementation(async (p: string) => {
        if (path.basename(p).startsWith("temp_upload_")) {
          throw Object.assign(new Error("denied"), { code: "EACCES" });
        }
        return realUnlink(p);
      });
      try {
        receiveFile("BBB", { slug: "bad slug!" });
        const res = await POST(makeRequest(chunkHeaders(1, 2)));
        expect(res.status).toBe(400);
        expect(errorSpy).toHaveBeenCalledWith(
          "Upload: failed to remove session file:",
          expect.objectContaining({ code: "EACCES" })
        );
      } finally {
        unlinkSpy.mockImplementation(realUnlink);
      }
    });

    it("stays silent when the session file is already gone during cleanup", async () => {
      receiveFile("AAA");
      await POST(makeRequest(chunkHeaders(0, 2)));
      const [session] = sessionFiles();
      receiveFile("BBB", { slug: "bad slug!" });
      // Delete the session file right before finalization (ENOENT on stat and unlink)
      mockFindUnique.mockImplementation(async () => {
        fs.rmSync(path.join(uploadsDir, session), { force: true });
        return null;
      });
      const res = await POST(makeRequest(chunkHeaders(1, 2)));
      expect(res.status).toBe(400);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("returns a 500 when the session file cannot be inspected", async () => {
      const statSpy = (fsPromises.stat as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error("denied"), { code: "EACCES" })
      );
      try {
        const res = await POST(makeRequest(chunkHeaders(1, 2)));
        expect(res.status).toBe(500);
      } finally {
        statSpy.mockClear();
      }
    });
  });
});
