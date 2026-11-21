/** @jest-environment node */

// Integration test: the real tus protocol (@tus/server + @tus/file-store) driven over HTTP with
// the production hooks from tus-server.ts and fully mocked libs.
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStore } from "@tus/file-store";
import { Server as TusServer } from "@tus/server";
import { createTusHooks, type TusLibs, type TusUploadContext } from "@/lib/tus-server";

class FakeUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
  }
}

const TUS_HEADERS = { "Tus-Resumable": "1.0.0" };

function metadataHeader(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([key, value]) => `${key} ${Buffer.from(value).toString("base64")}`)
    .join(",");
}

describe("tus protocol with the production hooks", () => {
  const requestContext = new AsyncLocalStorage<TusUploadContext>();
  const storedFiles = new Map<string, Buffer>();
  let tusTempDir: string;
  let server: Server;
  let baseUrl: string;
  let libs: ReturnType<typeof createLibs>;

  function createLibs() {
    return {
      prisma: {
        share: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
        shareFile: { create: jest.fn().mockResolvedValue({}) },
      },
      getUploadLimits: jest.fn(),
      assertFileUploadAllowed: jest.fn().mockResolvedValue(undefined),
      validateUploadOptions: jest.fn().mockResolvedValue({}),
      resolveUploadOptions: jest.fn().mockResolvedValue({ resolved: true }),
      createFileShareRecord: jest.fn(),
      generateSafeFilename: jest.fn(
        (name: string, shareId: string) => `${shareId}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      ),
      // Same observable effect as the real one: the temp file leaves the tus directory
      moveToStorage: jest.fn(async (tempPath: string, key: string) => {
        storedFiles.set(key, await readFile(tempPath));
        await rm(tempPath);
      }),
      deleteFromStorage: jest.fn().mockResolvedValue(undefined),
      emitShareEvent: jest.fn().mockResolvedValue(undefined),
      rollbackShare: jest.fn().mockResolvedValue(undefined),
      UploadError: FakeUploadError,
    };
  }

  function resetLibs() {
    libs.getUploadLimits.mockReset().mockResolvedValue({
      maxFileSizeBytes: 1000,
      remainingQuotaBytes: 100_000,
    });
    libs.createFileShareRecord.mockReset().mockResolvedValue({
      id: "share-1",
      slug: "my-slug",
      expiresAt: null,
    });
    libs.moveToStorage.mockClear();
    libs.assertFileUploadAllowed.mockClear();
    libs.validateUploadOptions.mockReset().mockResolvedValue({});
    libs.resolveUploadOptions.mockReset().mockResolvedValue({ resolved: true });
    libs.rollbackShare.mockClear();
    libs.emitShareEvent.mockClear();
    libs.prisma.share.update.mockClear();
    storedFiles.clear();
  }

  /** The uploader is picked per HTTP request, like handleTus does after authenticating. */
  function contextFromRequest(headers: Record<string, string | string[] | undefined>) {
    const userId = (headers["x-test-user"] as string | undefined) || null;
    return {
      clientIp: "10.0.0.1",
      userId,
      isAuthenticated: !!userId,
    } satisfies TusUploadContext;
  }

  async function createUpload(
    length: number,
    metadata: Record<string, string> = { filename: "hello.txt", filetype: "text/plain" },
    extraHeaders: Record<string, string> = { "x-test-user": "user-1" }
  ) {
    return fetch(`${baseUrl}/api/tus`, {
      method: "POST",
      headers: {
        ...TUS_HEADERS,
        "Upload-Length": String(length),
        "Upload-Metadata": metadataHeader(metadata),
        ...extraHeaders,
      },
    });
  }

  function patch(
    location: string,
    offset: number,
    body: Buffer,
    extraHeaders: Record<string, string> = { "x-test-user": "user-1" }
  ) {
    return fetch(`${baseUrl}${location}`, {
      method: "PATCH",
      headers: {
        ...TUS_HEADERS,
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": String(offset),
        ...extraHeaders,
      },
      body: new Uint8Array(body),
    });
  }

  beforeAll(async () => {
    tusTempDir = await mkdtemp(path.join(os.tmpdir(), "snowshare-tus-http-"));
    libs = createLibs();
    resetLibs();

    const hooks = createTusHooks({
      loadLibs: async () => libs as unknown as TusLibs,
      getRequestContext: () => requestContext.getStore(),
      tusTempDir,
    });
    const tusServer = new TusServer({
      path: "/api/tus",
      datastore: new FileStore({ directory: tusTempDir }),
      respectForwardedHeaders: true,
      // Relative URL, like server.js
      generateUrl(_req, { path: urlPath, id }) {
        return `${urlPath}/${id}`;
      },
      ...hooks,
    });

    server = createServer((req, res) => {
      requestContext.run(contextFromRequest(req.headers), () => {
        void tusServer.handle(req, res);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(tusTempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    resetLibs();
    // Start every test from an empty tus directory (abandoned uploads of previous tests)
    for (const entry of await readdir(tusTempDir)) {
      await rm(path.join(tusTempDir, entry), { force: true });
    }
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates an upload and answers 201 with a relative Location", async () => {
    const response = await createUpload(11);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toMatch(/^\/api\/tus\/[^/]+$/);
    expect(libs.assertFileUploadAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", isAuthenticated: true })
    );
    expect(libs.validateUploadOptions).toHaveBeenCalledTimes(1);
    expect(libs.moveToStorage).not.toHaveBeenCalled();
  });

  it("rejects a file above the limit with 413 and a JSON error body", async () => {
    const response = await createUpload(5000);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "FILE_TOO_LARGE" });
    expect(libs.createFileShareRecord).not.toHaveBeenCalled();
  });

  it("rejects a file above the remaining quota with 429", async () => {
    libs.getUploadLimits.mockResolvedValue({ maxFileSizeBytes: 1000, remainingQuotaBytes: 5 });

    const response = await createUpload(10);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "IP_QUOTA_EXCEEDED" });
  });

  it("fails closed with 503 when the quota cannot be computed", async () => {
    libs.getUploadLimits.mockRejectedValue(new Error("db down"));

    const response = await createUpload(10);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "QUOTA_UNAVAILABLE" });
  });

  it("maps an UploadError from option validation to its status and code", async () => {
    libs.validateUploadOptions.mockRejectedValue(new FakeUploadError(409, "SLUG_ALREADY_TAKEN"));

    const response = await createUpload(10);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "SLUG_ALREADY_TAKEN" });
  });

  it("completes a single-request upload and returns the share headers on the final PATCH", async () => {
    const payload = Buffer.from("hello world");
    const location = (await createUpload(payload.length)).headers.get("Location") as string;

    const response = await patch(location, 0, payload);

    expect(response.status).toBe(204);
    expect(response.headers.get("Upload-Offset")).toBe(String(payload.length));
    expect(response.headers.get("X-Share-Slug")).toBe("my-slug");
    expect(response.headers.get("X-Share-Id")).toBe("share-1");
    expect(response.headers.get("X-Is-Bulk")).toBe("false");
    expect(libs.moveToStorage).toHaveBeenCalledTimes(1);
    expect(libs.moveToStorage).toHaveBeenCalledWith(
      expect.stringContaining(tusTempDir),
      "share-1_hello.txt"
    );
    expect(storedFiles.get("share-1_hello.txt")?.toString()).toBe("hello world");
    expect(libs.prisma.share.update).toHaveBeenCalledWith({
      where: { id: "share-1" },
      data: { filePath: "share-1_hello.txt" },
    });
    expect(libs.emitShareEvent).toHaveBeenCalledWith(
      "share.created",
      expect.objectContaining({ id: "share-1" })
    );
    // The temp file and its tus sidecar are gone
    expect(await readdir(tusTempDir)).toEqual([]);
  });

  it("resumes an interrupted upload and finishes the share exactly once", async () => {
    const payload = Buffer.from("0123456789abcdef");
    const location = (await createUpload(payload.length)).headers.get("Location") as string;

    const first = await patch(location, 0, payload.subarray(0, 6));
    expect(first.status).toBe(204);
    expect(first.headers.get("Upload-Offset")).toBe("6");
    expect(first.headers.get("X-Share-Id")).toBeNull();
    expect(libs.moveToStorage).not.toHaveBeenCalled();

    const head = await fetch(`${baseUrl}${location}`, {
      method: "HEAD",
      headers: { ...TUS_HEADERS, "x-test-user": "user-1" },
    });
    expect(head.status).toBe(200);
    expect(head.headers.get("Upload-Offset")).toBe("6");
    expect(head.headers.get("Upload-Length")).toBe(String(payload.length));

    const second = await patch(location, 6, payload.subarray(6));
    expect(second.status).toBe(204);
    expect(second.headers.get("Upload-Offset")).toBe(String(payload.length));
    expect(second.headers.get("X-Share-Slug")).toBe("my-slug");
    expect(second.headers.get("X-Share-Id")).toBe("share-1");

    expect(libs.createFileShareRecord).toHaveBeenCalledTimes(1);
    expect(libs.moveToStorage).toHaveBeenCalledTimes(1);
    expect(storedFiles.get("share-1_hello.txt")?.toString()).toBe("0123456789abcdef");
  });

  it("keeps the creation-time context at finish even when the request context differs", async () => {
    const payload = Buffer.from("secret");
    const location = (
      await createUpload(payload.length, { filename: "a.txt" }, { "x-test-user": "owner" })
    ).headers.get("Location") as string;

    // The final PATCH comes from a different (anonymous) request context, e.g. after a restart
    const response = await patch(location, 0, payload, {});

    expect(response.status).toBe(204);
    expect(libs.createFileShareRecord).toHaveBeenCalledWith(
      expect.anything(),
      { clientIp: "10.0.0.1", userId: "owner", isAuthenticated: true },
      { isBulk: false, size: payload.length }
    );
    expect(libs.resolveUploadOptions).toHaveBeenCalledWith(
      expect.anything(),
      { clientIp: "10.0.0.1", userId: "owner", isAuthenticated: true },
      { anonExpiry: "clamp" }
    );
  });

  it("cannot be tricked by client-supplied ss_* metadata", async () => {
    const payload = Buffer.from("x");
    const location = (
      await createUpload(
        payload.length,
        { filename: "a.txt", ss_auth: "1", ss_user: "admin", ss_ip: "6.6.6.6" },
        {}
      )
    ).headers.get("Location") as string;

    await patch(location, 0, payload, {});

    expect(libs.createFileShareRecord).toHaveBeenCalledWith(
      expect.anything(),
      { clientIp: "10.0.0.1", userId: null, isAuthenticated: false },
      expect.anything()
    );
  });

  it("rolls back the share and keeps the temp file when storing fails", async () => {
    libs.moveToStorage.mockRejectedValueOnce(new Error("disk full"));
    const payload = Buffer.from("abc");
    const location = (await createUpload(payload.length)).headers.get("Location") as string;

    const response = await patch(location, 0, payload);

    expect(response.status).toBe(500);
    expect(libs.rollbackShare).toHaveBeenCalledWith("share-1");
    expect(libs.emitShareEvent).not.toHaveBeenCalled();
    expect((await readdir(tusTempDir)).length).toBe(2);
  });

  it("removes the temp files of an upload rejected on finish", async () => {
    libs.resolveUploadOptions.mockRejectedValueOnce(new FakeUploadError(409, "SLUG_ALREADY_TAKEN"));
    const payload = Buffer.from("abc");
    const location = (await createUpload(payload.length)).headers.get("Location") as string;

    const response = await patch(location, 0, payload);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "SLUG_ALREADY_TAKEN" });
    expect(libs.moveToStorage).not.toHaveBeenCalled();
    expect(await readdir(tusTempDir)).toEqual([]);
  });
});
