/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { reverseShare: { findUnique: jest.fn() } },
}));
jest.mock("archiver", () => ({ ZipArchive: jest.fn() }));
jest.mock("@/lib/getClientIp", () => ({ getClientIp: jest.fn(() => "10.0.0.9") }));
jest.mock("@/lib/quota-shared", () => ({ getUploadLimits: jest.fn() }));
jest.mock("@/lib/security", () => ({
  ...jest.requireActual("@/lib/security"),
  verifyPassword: jest.fn(async (p: string, h: string) => h === `hash:${p}`),
}));
jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));
jest.mock("@/lib/multipart-upload", () => ({
  ...jest.requireActual("@/lib/multipart-upload"),
  receiveMultipart: jest.fn(),
  removeTempFiles: jest.fn(),
}));
jest.mock("@/lib/upload-share", () => ({
  ...jest.requireActual("@/lib/upload-share"),
  createFileShareRecord: jest.fn(),
  storeBulkFiles: jest.fn(),
}));
jest.mock("@/lib/reverse-shares", () => ({
  ...jest.requireActual("@/lib/reverse-shares"),
  claimReverseShareSlot: jest.fn(),
  releaseReverseShareSlot: jest.fn(),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUploadLimits } from "@/lib/quota-shared";
import { receiveMultipart } from "@/lib/multipart-upload";
import { createFileShareRecord, storeBulkFiles } from "@/lib/upload-share";
import { claimReverseShareSlot, releaseReverseShareSlot } from "@/lib/reverse-shares";
import { resetRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/(shares)/r/[slug]/api/route";

const findUnique = prisma.reverseShare.findUnique as jest.Mock;
const claim = claimReverseShareSlot as jest.Mock;
const release = releaseReverseShareSlot as jest.Mock;
const receive = receiveMultipart as jest.Mock;
const createShare = createFileShareRecord as jest.Mock;
const store = storeBulkFiles as jest.Mock;

const rs = {
  id: "r1",
  slug: "photos",
  ownerId: "owner",
  name: "Wedding",
  password: null as string | null,
  expiresAt: null,
  maxUploads: null,
  maxSizeMB: 5,
  uploadCount: 0,
  createdAt: new Date(),
};

function req(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/r/photos/api", {
    method: "POST",
    body: "payload",
    headers: { "content-type": "multipart/form-data; boundary=x", ...headers },
  });
}
const params = { params: Promise.resolve({ slug: "photos" }) };

beforeEach(() => {
  jest.clearAllMocks();
  resetRateLimit("reverseShareUpload", "10.0.0.9");
  resetRateLimit("sharePassword", "10.0.0.9:r1");
  (getUploadLimits as jest.Mock).mockResolvedValue({
    maxFileSizeBytes: 100 * 1024 * 1024,
    remainingQuotaBytes: 100 * 1024 * 1024,
    ipQuotaMB: 100,
  });
  claim.mockResolvedValue(true);
  receive.mockResolvedValue({
    files: [{ filename: "a.jpg", tempPath: "/tmp/a", size: 3, mimeType: "image/jpeg" }],
    fields: { message: "hello" },
  });
  createShare.mockResolvedValue({ id: "s1" });
  store.mockResolvedValue(undefined);
});

describe("POST /r/:slug/api", () => {
  it("returns 404 for an unknown link", async () => {
    findUnique.mockResolvedValue(null);
    expect((await POST(req(), params)).status).toBe(404);
  });

  it("returns 410 when the link is full", async () => {
    findUnique.mockResolvedValue({ ...rs, maxUploads: 1, uploadCount: 1 });
    expect((await POST(req(), params)).status).toBe(410);
    expect(receive).not.toHaveBeenCalled();
  });

  it("checks the password before receiving files", async () => {
    findUnique.mockResolvedValue({ ...rs, password: "hash:secret" });
    expect((await POST(req({ "x-reverse-share-password": "nope" }), params)).status).toBe(400);
    expect(receive).not.toHaveBeenCalled();
    expect((await POST(req({ "x-reverse-share-password": "secret" }), params)).status).toBe(201);
  });

  it("creates a bulk share owned by the link owner, capped to maxSizeMB", async () => {
    findUnique.mockResolvedValue(rs);
    const res = await POST(req(), params);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { fileCount: 1 } });
    expect(receive.mock.calls[0][1].maxTotalBytes).toBe(5 * 1024 * 1024);
    expect(getUploadLimits).toHaveBeenCalledWith("10.0.0.9", false);
    expect(createShare).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Wedding\n\nhello", passwordHash: null }),
      { clientIp: "10.0.0.9", userId: "owner", isAuthenticated: true },
      { isBulk: true }
    );
    expect(store).toHaveBeenCalledWith("s1", [expect.objectContaining({ relativePath: "a.jpg" })]);
  });

  it("gives the slot back when storing fails", async () => {
    findUnique.mockResolvedValue(rs);
    store.mockRejectedValue(new Error("disk full"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req(), params)).status).toBe(500);
    expect(release).toHaveBeenCalledWith("r1");
  });

  it("returns 410 when the last slot was taken concurrently", async () => {
    findUnique.mockResolvedValue(rs);
    claim.mockResolvedValue(false);
    expect((await POST(req(), params)).status).toBe(410);
  });
});
