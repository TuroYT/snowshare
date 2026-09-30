/**
 * @jest-environment node
 */

jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
}));
jest.mock("@/lib/api-auth", () => ({ authenticateApiRequest: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  rateLimitResponse: jest.fn(
    () => new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })
  ),
}));
jest.mock("@/lib/shares", () => ({ createFileShare: jest.fn() }));
jest.mock("@/lib/getClientIp", () => ({ getClientIp: jest.fn(() => "10.0.0.2") }));
jest.mock("@/lib/quota-shared", () => ({ getUploadLimits: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { share: { update: jest.fn() } } }));
jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));
jest.mock("@/lib/multipart-upload", () => ({
  ...jest.requireActual("@/lib/multipart-upload"),
  receiveMultipart: jest.fn(),
  removeTempFiles: jest.fn(async () => undefined),
}));
jest.mock("@/lib/upload-share", () => ({
  ...jest.requireActual("@/lib/upload-share"),
  moveToStorage: jest.fn(),
  rollbackShare: jest.fn(),
}));

import { mkdir } from "node:fs/promises";
import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { createFileShare } from "@/lib/shares";
import { getUploadLimits } from "@/lib/quota-shared";
import { prisma } from "@/lib/prisma";
import { ErrorCode } from "@/lib/api-errors";
import { MultipartError, receiveMultipart, removeTempFiles } from "@/lib/multipart-upload";
import { moveToStorage, rollbackShare } from "@/lib/upload-share";
import { POST } from "@/app/api/v1/upload/route";

const mockAuth = authenticateApiRequest as jest.Mock;
const mockLimits = getUploadLimits as jest.Mock;
const mockReceive = receiveMultipart as jest.Mock;
const mockCreateFileShare = createFileShare as jest.Mock;
const mockUpdate = prisma.share.update as jest.Mock;
const mockMove = moveToStorage as jest.Mock;
const mockRollback = rollbackShare as jest.Mock;
const mockRemoveTemp = removeTempFiles as jest.Mock;
const mockMkdir = mkdir as jest.Mock;

const UPLOADS = "/tmp/snowshare-v1-uploads";
const LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileSizeMB: 10,
  remainingQuotaBytes: 5 * 1024 * 1024,
  ipQuotaBytes: 20 * 1024 * 1024,
  ipQuotaMB: 20,
};
const USER = { id: "user-1", name: "Alice", email: "a@example.com", isAdmin: false };
const FILE = {
  fieldName: "file",
  filename: "doc.pdf",
  mimeType: "application/pdf",
  tempPath: `${UPLOADS}/upload_tmp_abc`,
  size: 1234,
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/v1/upload", {
    method: "POST",
    body: "payload",
    headers: { "content-type": "multipart/form-data; boundary=xyz" },
  });
}

describe("POST /api/v1/upload", () => {
  let errorSpy: jest.SpyInstance;
  const originalUploadDir = process.env.UPLOAD_DIR;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPLOAD_DIR = UPLOADS;
    mockAuth.mockResolvedValue({ user: USER });
    mockLimits.mockResolvedValue({ ...LIMITS });
    mockReceive.mockResolvedValue({ files: [FILE], fields: {} });
    mockCreateFileShare.mockResolvedValue({
      share: { id: "share-1", slug: "abc123", expiresAt: null },
    });
    mockUpdate.mockResolvedValue({});
    mockMove.mockResolvedValue(undefined);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  });

  it("returns 429 when the API key is rate limited", async () => {
    mockAuth.mockResolvedValue({ user: null, retryAfter: 30 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(rateLimitResponse).toHaveBeenCalledWith(expect.anything(), 30);
    expect(mockLimits).not.toHaveBeenCalled();
  });

  it("returns an IP quota error before receiving anything when quota is exhausted", async () => {
    mockLimits.mockResolvedValue({ ...LIMITS, remainingQuotaBytes: 0 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe(ErrorCode.IP_QUOTA_EXCEEDED);
    expect(mockReceive).not.toHaveBeenCalled();
  });

  it("uploads a file for an authenticated user", async () => {
    mockReceive.mockResolvedValue({
      files: [FILE],
      fields: {
        slug: "my-slug",
        password: "secret123",
        expiresAt: "2030-01-01T00:00:00.000Z",
        maxViews: "5",
      },
    });
    mockCreateFileShare.mockResolvedValue({
      share: { id: "share-1", slug: "my-slug", expiresAt: new Date("2030-01-01T00:00:00.000Z") },
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      share: { slug: "my-slug", url: "/f/my-slug", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    expect(mockMkdir).toHaveBeenCalledWith(UPLOADS, { recursive: true });
    expect(mockReceive.mock.calls[0][1]).toMatchObject({
      tempDir: UPLOADS,
      maxFileBytes: LIMITS.maxFileSizeBytes,
      maxTotalBytes: LIMITS.remainingQuotaBytes,
      maxFiles: 1,
    });
    const accept = mockReceive.mock.calls[0][1].acceptFile as (name: string) => boolean;
    expect(accept("file")).toBe(true);
    expect(accept("other")).toBe(false);

    expect(mockCreateFileShare).toHaveBeenCalledWith({
      filename: "doc.pdf",
      filePath: "upload_tmp_abc",
      size: 1234,
      context: { userId: "user-1", isAuthenticated: true, ip: "10.0.0.2" },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      slug: "my-slug",
      password: "secret123",
      maxViews: 5,
    });
    const key = mockMove.mock.calls[0][1] as string;
    expect(mockMove).toHaveBeenCalledWith(FILE.tempPath, key);
    expect(key).toContain("share-1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "share-1" },
      data: { filePath: key },
    });
  });

  it("uploads anonymously with empty optional fields", async () => {
    mockAuth.mockResolvedValue({ user: null });
    mockReceive.mockResolvedValue({ files: [FILE], fields: { slug: "", password: "" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    expect(mockLimits).toHaveBeenCalledWith("10.0.0.2", false);
    const params = mockCreateFileShare.mock.calls[0][0];
    expect(params.context).toEqual({ userId: null, isAuthenticated: false, ip: "10.0.0.2" });
    expect(params.slug).toBeUndefined();
    expect(params.password).toBeUndefined();
    expect(params.expiresAt).toBeUndefined();
    expect(params.maxViews).toBeUndefined();
  });

  it("returns FILE_REQUIRED when no file was sent", async () => {
    mockReceive.mockResolvedValue({ files: [], fields: {} });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(ErrorCode.FILE_REQUIRED);
    expect(mockCreateFileShare).not.toHaveBeenCalled();
  });

  it("rejects an invalid expiration date and removes the temp file", async () => {
    mockReceive.mockResolvedValue({ files: [FILE], fields: { expiresAt: "garbage" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(ErrorCode.INVALID_REQUEST);
    expect(mockRemoveTemp).toHaveBeenCalledWith([FILE]);
    expect(mockCreateFileShare).not.toHaveBeenCalled();
  });

  it("returns the share creation error and removes the temp file", async () => {
    mockCreateFileShare.mockResolvedValue({
      errorCode: ErrorCode.SLUG_ALREADY_TAKEN,
      params: {},
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(ErrorCode.SLUG_ALREADY_TAKEN);
    expect(mockRemoveTemp).toHaveBeenCalledWith([FILE]);
    expect(mockMove).not.toHaveBeenCalled();
  });

  it("rolls back the share when moving to storage fails", async () => {
    mockMove.mockRejectedValue(new Error("disk full"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalledWith("share-1");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRemoveTemp).toHaveBeenCalledWith([FILE]);
  });

  it("rolls back the share when the database update fails", async () => {
    mockUpdate.mockRejectedValue(new Error("db failure"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalledWith("share-1");
  });

  it("maps a file too large error with the endpoint status", async () => {
    mockReceive.mockRejectedValue(new MultipartError("FILE_TOO_LARGE"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe(ErrorCode.FILE_TOO_LARGE);
    expect(mockRemoveTemp).toHaveBeenCalledWith([]);
  });

  it("maps a total too large error to an IP quota error", async () => {
    mockReceive.mockRejectedValue(new MultipartError("TOTAL_TOO_LARGE"));
    const res = await POST(makeRequest());
    expect((await res.json()).code).toBe(ErrorCode.IP_QUOTA_EXCEEDED);
  });

  it("delegates other multipart errors to the shared error response", async () => {
    mockReceive.mockRejectedValue(new MultipartError("TOO_MANY_FILES"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(ErrorCode.TOO_MANY_FILES);
  });

  it("returns a 500 for unexpected errors", async () => {
    mockMkdir.mockRejectedValueOnce(new Error("EACCES"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
  });
});
