/**
 * @jest-environment node
 */

// tus-server.ts imports its siblings with `./x.js` specifiers (it is loaded by server.js through
// tsx, without the `@/` alias). Jest cannot resolve those to the .ts sources, hence virtual mocks.
const mockGetRetryAfter = jest.fn();
const mockRecordRateLimitHit = jest.fn();
jest.mock(
  "../../lib/rate-limit.js",
  () => ({ getRetryAfter: mockGetRetryAfter, recordRateLimitHit: mockRecordRateLimitHit }),
  { virtual: true }
);

const mockApiKeyFindUnique = jest.fn();
const mockApiKeyUpdate = jest.fn();
jest.mock(
  "../../lib/prisma.js",
  () => ({
    prisma: { apiKey: { findUnique: mockApiKeyFindUnique, update: mockApiKeyUpdate } },
  }),
  { virtual: true }
);

jest.mock("../../lib/security.js", () => ({ hashApiKey: (key: string) => `hash:${key}` }), {
  virtual: true,
});

const mockApplyAccountState = jest.fn();
jest.mock("../../lib/account-state.js", () => ({ applyAccountState: mockApplyAccountState }), {
  virtual: true,
});

const mockGetToken = jest.fn();
jest.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertWithinLimits,
  authenticateFromRequest,
  createTusHooks,
  isBulkSubsequentFile,
  parseCookies,
  readUploadContext,
  toTusError,
  tusError,
  type TusLibs,
  type TusUploadContext,
} from "@/lib/tus-server";

class FakeUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
  }
}

function createLibs() {
  return {
    prisma: {
      share: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      shareFile: { create: jest.fn().mockResolvedValue({}) },
    },
    getUploadLimits: jest.fn().mockResolvedValue({
      maxFileSizeBytes: 1000,
      remainingQuotaBytes: 5000,
    }),
    assertFileUploadAllowed: jest.fn().mockResolvedValue(undefined),
    validateUploadOptions: jest.fn().mockResolvedValue({}),
    resolveUploadOptions: jest.fn().mockResolvedValue({ resolved: true }),
    createFileShareRecord: jest.fn().mockResolvedValue({
      id: "share-1",
      slug: "my-slug",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    }),
    generateSafeFilename: jest.fn().mockReturnValue("share-1_file.txt"),
    moveToStorage: jest.fn().mockResolvedValue(undefined),
    deleteFromStorage: jest.fn().mockResolvedValue(undefined),
    emitShareEvent: jest.fn().mockResolvedValue(undefined),
    rollbackShare: jest.fn().mockResolvedValue(undefined),
    UploadError: FakeUploadError,
  };
}

type FakeLibs = ReturnType<typeof createLibs>;

const anonContext: TusUploadContext = {
  clientIp: "1.2.3.4",
  userId: null,
  isAuthenticated: false,
};
const userContext: TusUploadContext = {
  clientIp: "1.2.3.4",
  userId: "user-1",
  isAuthenticated: true,
};

/** Catches the rejection of a promise so assertions can inspect the thrown value. */
async function rejection(promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    return error as Record<string, unknown>;
  }
  throw new Error("Expected the promise to reject");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRetryAfter.mockReturnValue(0);
  mockApiKeyUpdate.mockResolvedValue({});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("parseCookies", () => {
  it("returns an empty object for an empty header", () => {
    expect(parseCookies("")).toEqual({});
  });

  it("parses multiple cookies", () => {
    expect(parseCookies("a=1; b=2;c=3")).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("keeps '=' characters inside the value", () => {
    expect(parseCookies("token=abc==; other=x=y")).toEqual({ token: "abc==", other: "x=y" });
  });

  it("decodes URL-encoded values", () => {
    expect(parseCookies("name=hello%20world%3D")).toEqual({ name: "hello world=" });
  });

  it("ignores entries without a name", () => {
    expect(parseCookies("=orphan; ok=1")).toEqual({ ok: "1" });
  });
});

describe("authenticateFromRequest", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockGetToken.mockResolvedValue(null);
    mockApplyAccountState.mockImplementation(async (token: unknown) => token);
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it("authenticates a valid API key", async () => {
    mockApiKeyFindUnique.mockResolvedValue({ id: "key-1", userId: "user-9", expiresAt: null });

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_valid" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: "user-9", isAuthenticated: true });
    expect(mockApiKeyFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyHash: "hash:sk_valid" } })
    );
    expect(mockApiKeyUpdate).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(mockRecordRateLimitHit).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("accepts an API key that expires in the future", async () => {
    mockApiKeyFindUnique.mockResolvedValue({
      id: "key-1",
      userId: "user-9",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_valid" } },
      "9.9.9.9"
    );

    expect(result.isAuthenticated).toBe(true);
  });

  it("does not fail when updating lastUsedAt rejects", async () => {
    mockApiKeyFindUnique.mockResolvedValue({ id: "key-1", userId: "user-9", expiresAt: null });
    mockApiKeyUpdate.mockRejectedValue(new Error("db down"));

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_valid" } },
      "9.9.9.9"
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(result).toEqual({ userId: "user-9", isAuthenticated: true });
    expect(console.warn).toHaveBeenCalledWith("[Auth] Failed to update lastUsedAt:", "db down");
  });

  it("falls back to anonymous and records a rate-limit hit for an unknown key", async () => {
    mockApiKeyFindUnique.mockResolvedValue(null);

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_unknown" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false });
    expect(mockRecordRateLimitHit).toHaveBeenCalledWith("apiKey", "9.9.9.9");
  });

  it("falls back to anonymous and records a rate-limit hit for an expired key", async () => {
    mockApiKeyFindUnique.mockResolvedValue({
      id: "key-1",
      userId: "user-9",
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_expired" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false });
    expect(mockRecordRateLimitHit).toHaveBeenCalledWith("apiKey", "9.9.9.9");
    expect(mockApiKeyUpdate).not.toHaveBeenCalled();
  });

  it("returns retryAfter without looking the key up when the IP is throttled", async () => {
    mockGetRetryAfter.mockReturnValue(42);

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_valid" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false, retryAfter: 42 });
    expect(mockGetRetryAfter).toHaveBeenCalledWith("apiKey", "9.9.9.9");
    expect(mockApiKeyFindUnique).not.toHaveBeenCalled();
  });

  it("falls back to anonymous when the API key lookup throws", async () => {
    mockApiKeyFindUnique.mockRejectedValue(new Error("db down"));

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_valid" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false });
    expect(console.error).toHaveBeenCalledWith("[Auth] API key lookup error:", "db down");
    expect(mockRecordRateLimitHit).not.toHaveBeenCalled();
  });

  it("ignores a bearer token that is not an sk_ API key", async () => {
    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer jwt.token.here" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false });
    expect(mockGetRetryAfter).not.toHaveBeenCalled();
    expect(mockApiKeyFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["revoked by a password change", { id: "user-7", revoked: true }],
    ["waiting for a forced password change", { id: "user-7", mustChangePassword: true }],
  ])("treats a JWT session %s as anonymous", async (_name, state) => {
    mockGetToken.mockResolvedValue({ id: "user-7" });
    mockApplyAccountState.mockResolvedValue(state);

    const result = await authenticateFromRequest(
      { headers: { cookie: "next-auth.session-token=abc" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false });
  });

  it("treats a JWT session as anonymous when its state cannot be checked (fail closed)", async () => {
    mockGetToken.mockResolvedValue({ id: "user-7" });
    mockApplyAccountState.mockRejectedValue(new Error("db down"));

    const result = await authenticateFromRequest(
      { headers: { cookie: "next-auth.session-token=abc" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: null, isAuthenticated: false });
    expect(console.error).toHaveBeenCalledWith("[Auth] Error:", "db down");
  });

  it("authenticates from the NextAuth JWT cookie", async () => {
    mockGetToken.mockResolvedValue({ id: "user-7" });

    const result = await authenticateFromRequest(
      { headers: { cookie: "next-auth.session-token=a%3Db; theme=dark" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: "user-7", isAuthenticated: true });
    expect(mockGetToken).toHaveBeenCalledWith({
      req: {
        headers: { cookie: "next-auth.session-token=a%3Db; theme=dark" },
        cookies: { "next-auth.session-token": "a=b", theme: "dark" },
      },
      secret: "test-secret",
    });
  });

  it("falls through to the JWT cookie when the API key is invalid", async () => {
    mockApiKeyFindUnique.mockResolvedValue(null);
    mockGetToken.mockResolvedValue({ id: "user-7" });

    const result = await authenticateFromRequest(
      { headers: { authorization: "Bearer sk_bad", cookie: "session=abc" } },
      "9.9.9.9"
    );

    expect(result).toEqual({ userId: "user-7", isAuthenticated: true });
    expect(mockRecordRateLimitHit).toHaveBeenCalledWith("apiKey", "9.9.9.9");
  });

  it("is anonymous when the token carries no user id", async () => {
    mockGetToken.mockResolvedValue({ name: "someone" });

    const result = await authenticateFromRequest({ headers: {} }, "9.9.9.9");

    expect(result).toEqual({ userId: null, isAuthenticated: false });
  });

  it("is anonymous when getToken throws", async () => {
    mockGetToken.mockRejectedValue(new Error("bad jwt"));

    const result = await authenticateFromRequest({ headers: { cookie: "a=b" } }, "9.9.9.9");

    expect(result).toEqual({ userId: null, isAuthenticated: false });
    expect(console.error).toHaveBeenCalledWith("[Auth] Error:", "bad jwt");
  });
});

describe("tusError / toTusError", () => {
  it("builds an Error carrying status_code and body", () => {
    const error = tusError(418, "teapot");

    expect(error).toBeInstanceOf(Error);
    expect(error.status_code).toBe(418);
    expect(error.body).toBe("teapot");
    expect(error.message).toBe("teapot");
  });

  it("returns errors that already have a status_code untouched", () => {
    const original = tusError(413, '{"error":"FILE_TOO_LARGE"}');

    expect(toTusError(original, FakeUploadError)).toBe(original);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("maps an UploadError through its status and code", () => {
    const error = toTusError(new FakeUploadError(403, "ANON_FILE_SHARE_DISABLED"), FakeUploadError);

    expect(error.status_code).toBe(403);
    expect(JSON.parse(error.body)).toEqual({ error: "ANON_FILE_SHARE_DISABLED" });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("maps an unknown error to a 500 and logs it", () => {
    const cause = new Error("boom");

    const error = toTusError(cause, FakeUploadError);

    expect(error.status_code).toBe(500);
    expect(JSON.parse(error.body)).toEqual({ error: "INTERNAL_SERVER_ERROR" });
    expect(console.error).toHaveBeenCalledWith("[Upload] Unexpected error:", cause);
  });

  it("maps non-object throwables to a 500", () => {
    expect(toTusError("nope", FakeUploadError).status_code).toBe(500);
    expect(toTusError(null).status_code).toBe(500);
  });
});

describe("readUploadContext", () => {
  it("returns null when the context was never persisted", () => {
    expect(readUploadContext(undefined)).toBeNull();
    expect(readUploadContext({ filename: "a.txt" })).toBeNull();
  });

  it("restores an authenticated context", () => {
    expect(readUploadContext({ ss_ip: "1.1.1.1", ss_user: "user-1", ss_auth: "1" })).toEqual({
      clientIp: "1.1.1.1",
      userId: "user-1",
      isAuthenticated: true,
    });
  });

  it("restores an anonymous context with a null user", () => {
    expect(readUploadContext({ ss_ip: "1.1.1.1", ss_user: "", ss_auth: "0" })).toEqual({
      clientIp: "1.1.1.1",
      userId: null,
      isAuthenticated: false,
    });
  });
});

describe("isBulkSubsequentFile", () => {
  it("is false for a non-bulk upload", () => {
    expect(isBulkSubsequentFile({ bulkShareId: "s1", fileIndex: "2" })).toBe(false);
  });

  it("is true when a bulkShareId is provided", () => {
    expect(isBulkSubsequentFile({ isBulk: "true", bulkShareId: "s1" })).toBe(true);
  });

  it("is true for a file index above zero", () => {
    expect(isBulkSubsequentFile({ isBulk: "true", fileIndex: "1" })).toBe(true);
  });

  it("is false for the first file of a bulk upload", () => {
    expect(isBulkSubsequentFile({ isBulk: "true", fileIndex: "0" })).toBe(false);
    expect(isBulkSubsequentFile({ isBulk: "true" })).toBe(false);
  });
});

describe("assertWithinLimits", () => {
  it("passes when the size fits the file limit and the quota", async () => {
    const libs = createLibs();

    await expect(assertWithinLimits(libs, anonContext, 1000)).resolves.toBeUndefined();
    expect(libs.getUploadLimits).toHaveBeenCalledWith("1.2.3.4", false);
  });

  it("fails closed with 503 when the limits cannot be computed", async () => {
    const libs = createLibs();
    libs.getUploadLimits.mockRejectedValue(new Error("db down"));

    const error = await rejection(assertWithinLimits(libs, anonContext, 1));

    expect(error.status_code).toBe(503);
    expect(JSON.parse(error.body as string)).toEqual({ error: "QUOTA_UNAVAILABLE" });
  });

  it("refuses a file above the per-file limit with 413", async () => {
    const libs = createLibs();

    const error = await rejection(assertWithinLimits(libs, anonContext, 1001));

    expect(error.status_code).toBe(413);
    expect(JSON.parse(error.body as string)).toEqual({ error: "FILE_TOO_LARGE" });
  });

  it("refuses a file above the remaining quota with 429", async () => {
    const libs = createLibs();
    libs.getUploadLimits.mockResolvedValue({ maxFileSizeBytes: 10_000, remainingQuotaBytes: 500 });

    const error = await rejection(assertWithinLimits(libs, userContext, 501));

    expect(error.status_code).toBe(429);
    expect(JSON.parse(error.body as string)).toEqual({ error: "IP_QUOTA_EXCEEDED" });
    expect(libs.getUploadLimits).toHaveBeenCalledWith("1.2.3.4", true);
  });
});

describe("createTusHooks", () => {
  let tusTempDir: string;
  let libs: FakeLibs;
  let requestContext: TusUploadContext | undefined;
  let hooks: ReturnType<typeof createTusHooks>;

  beforeEach(async () => {
    tusTempDir = await mkdtemp(path.join(os.tmpdir(), "snowshare-tus-hooks-"));
    libs = createLibs();
    requestContext = userContext;
    hooks = createTusHooks({
      loadLibs: async () => libs as unknown as TusLibs,
      getRequestContext: () => requestContext,
      tusTempDir,
    });
  });

  afterEach(async () => {
    await rm(tusTempDir, { recursive: true, force: true });
  });

  describe("onUploadCreate", () => {
    it("rejects a missing upload object with a 500", async () => {
      const error = await rejection(hooks.onUploadCreate({}, undefined));

      expect(error.status_code).toBe(500);
    });

    it("rejects with a 500 when there is no request context", async () => {
      requestContext = undefined;

      const error = await rejection(hooks.onUploadCreate({}, { id: "u1", size: 10 }));

      expect(error.status_code).toBe(500);
      expect(JSON.parse(error.body as string)).toEqual({ error: "INTERNAL_SERVER_ERROR" });
      expect(libs.assertFileUploadAllowed).not.toHaveBeenCalled();
    });

    it("persists the uploader context in the metadata when the size is known", async () => {
      const result = await hooks.onUploadCreate(
        {},
        { id: "u1", size: 10, metadata: { filename: "a.txt", ss_user: "forged", ss_auth: "1" } }
      );

      expect(result.metadata).toEqual({
        filename: "a.txt",
        ss_ip: "1.2.3.4",
        ss_user: "user-1",
        ss_auth: "1",
      });
      expect(libs.assertFileUploadAllowed).toHaveBeenCalledWith(userContext);
      expect(libs.getUploadLimits).toHaveBeenCalledWith("1.2.3.4", true);
    });

    it("overrides client-supplied context keys for an anonymous uploader", async () => {
      requestContext = anonContext;

      const result = await hooks.onUploadCreate(
        {},
        { id: "u1", size: 10, metadata: { ss_ip: "6.6.6.6", ss_auth: "1", ss_user: "admin" } }
      );

      expect(result.metadata).toMatchObject({
        ss_ip: "1.2.3.4",
        ss_user: "",
        ss_auth: "0",
      });
    });

    it("defers the limits check for deferred-length uploads", async () => {
      await hooks.onUploadCreate({}, { id: "u1", size: null, metadata: {} });

      expect(libs.getUploadLimits).not.toHaveBeenCalled();
    });

    it("validates the share options with the anonymous expiry clamped", async () => {
      await hooks.onUploadCreate(
        {},
        { id: "u1", size: 10, metadata: { slug: "abc", password: "pw", maxViews: "3" } }
      );

      expect(libs.validateUploadOptions).toHaveBeenCalledWith(
        { slug: "abc", password: "pw", expiresAt: undefined, maxViews: "3", note: undefined },
        userContext,
        { anonExpiry: "clamp" }
      );
    });

    it("skips option validation for subsequent files of a bulk share", async () => {
      await hooks.onUploadCreate(
        {},
        { id: "u1", size: 10, metadata: { isBulk: "true", bulkShareId: "share-1" } }
      );

      expect(libs.validateUploadOptions).not.toHaveBeenCalled();
    });

    it("validates the options of the first file of a bulk upload", async () => {
      await hooks.onUploadCreate(
        {},
        { id: "u1", size: 10, metadata: { isBulk: "true", fileIndex: "0" } }
      );

      expect(libs.validateUploadOptions).toHaveBeenCalledTimes(1);
    });

    it("rejects a file above the size limit with a 413", async () => {
      const error = await rejection(hooks.onUploadCreate({}, { id: "u1", size: 1001 }));

      expect(error.status_code).toBe(413);
      expect(JSON.parse(error.body as string)).toEqual({ error: "FILE_TOO_LARGE" });
    });

    it("rejects a file above the remaining quota with a 429", async () => {
      libs.getUploadLimits.mockResolvedValue({ maxFileSizeBytes: 10_000, remainingQuotaBytes: 5 });

      const error = await rejection(hooks.onUploadCreate({}, { id: "u1", size: 6 }));

      expect(error.status_code).toBe(429);
      expect(JSON.parse(error.body as string)).toEqual({ error: "IP_QUOTA_EXCEEDED" });
    });

    it("fails closed with a 503 when the limits lookup fails", async () => {
      libs.getUploadLimits.mockRejectedValue(new Error("db down"));

      const error = await rejection(hooks.onUploadCreate({}, { id: "u1", size: 1 }));

      expect(error.status_code).toBe(503);
      expect(JSON.parse(error.body as string)).toEqual({ error: "QUOTA_UNAVAILABLE" });
    });

    it("maps an UploadError thrown by a lib to a tus error", async () => {
      libs.assertFileUploadAllowed.mockRejectedValue(
        new FakeUploadError(403, "ANON_FILE_SHARE_DISABLED")
      );

      const error = await rejection(hooks.onUploadCreate({}, { id: "u1", size: 1 }));

      expect(error.status_code).toBe(403);
      expect(JSON.parse(error.body as string)).toEqual({ error: "ANON_FILE_SHARE_DISABLED" });
    });

    it("maps an unexpected error to a 500", async () => {
      libs.validateUploadOptions.mockRejectedValue(new Error("boom"));

      const error = await rejection(hooks.onUploadCreate({}, { id: "u1", size: 1 }));

      expect(error.status_code).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("onUploadFinish", () => {
    const finishedUpload = (overrides = {}) => ({
      id: "upload-1",
      size: 100,
      offset: 100,
      metadata: {
        filename: "file.txt",
        filetype: "text/plain",
        ss_ip: "1.2.3.4",
        ss_user: "user-1",
        ss_auth: "1",
      },
      ...overrides,
    });

    async function createTusFiles(id = "upload-1") {
      await writeFile(path.join(tusTempDir, id), "data");
      await writeFile(path.join(tusTempDir, `${id}.json`), "{}");
    }

    it("creates the share, stores the file and returns the share headers", async () => {
      await createTusFiles();
      // moveToStorage renames the temp file away; mimic it so the sidecar cleanup is observable
      libs.moveToStorage.mockImplementation(async (tempPath: string) => {
        await rm(tempPath);
      });

      const result = await hooks.onUploadFinish({}, finishedUpload());

      expect(libs.resolveUploadOptions).toHaveBeenCalledWith(
        {
          slug: undefined,
          password: undefined,
          expiresAt: undefined,
          maxViews: undefined,
          note: undefined,
        },
        userContext,
        { anonExpiry: "clamp" }
      );
      expect(libs.createFileShareRecord).toHaveBeenCalledWith({ resolved: true }, userContext, {
        isBulk: false,
        size: 100,
      });
      expect(libs.generateSafeFilename).toHaveBeenCalledWith("file.txt", "share-1", {
        unique: false,
      });
      expect(libs.moveToStorage).toHaveBeenCalledWith(
        path.join(tusTempDir, "upload-1"),
        "share-1_file.txt"
      );
      expect(libs.prisma.share.update).toHaveBeenCalledWith({
        where: { id: "share-1" },
        data: { filePath: "share-1_file.txt" },
      });
      expect(libs.prisma.shareFile.create).not.toHaveBeenCalled();
      expect(libs.emitShareEvent).toHaveBeenCalledWith(
        "share.created",
        expect.objectContaining({ id: "share-1" })
      );
      expect(libs.rollbackShare).not.toHaveBeenCalled();
      expect(result).toEqual({
        headers: {
          "X-Share-Slug": "my-slug",
          "X-Share-Id": "share-1",
          "X-Share-Expires": "2030-01-01T00:00:00.000Z",
          "X-Is-Bulk": "false",
        },
      });
      // The tus sidecar is removed once the file is in storage
      expect(await readdir(tusTempDir)).toEqual([]);
    });

    it("returns an empty expiry header for a share that never expires", async () => {
      libs.createFileShareRecord.mockResolvedValue({ id: "share-1", slug: "s", expiresAt: null });

      const result = await hooks.onUploadFinish({}, finishedUpload());

      expect(result.headers["X-Share-Expires"]).toBe("");
    });

    it("uses the persisted context rather than the request context", async () => {
      requestContext = anonContext;

      await hooks.onUploadFinish({}, finishedUpload());

      expect(libs.createFileShareRecord).toHaveBeenCalledWith(
        expect.anything(),
        { clientIp: "1.2.3.4", userId: "user-1", isAuthenticated: true },
        expect.anything()
      );
    });

    it("falls back to the request context for uploads created without a persisted one", async () => {
      requestContext = anonContext;

      await hooks.onUploadFinish({}, finishedUpload({ metadata: { filename: "file.txt" } }));

      expect(libs.createFileShareRecord).toHaveBeenCalledWith(
        expect.anything(),
        anonContext,
        expect.anything()
      );
    });

    it("rejects with a 500 when no context is available at all", async () => {
      requestContext = undefined;

      const error = await rejection(
        hooks.onUploadFinish({}, finishedUpload({ metadata: { filename: "file.txt" } }))
      );

      expect(error.status_code).toBe(500);
      expect(libs.createFileShareRecord).not.toHaveBeenCalled();
    });

    it("uses defaults for a missing filename and falls back to the offset for the size", async () => {
      await hooks.onUploadFinish(
        {},
        {
          id: "upload-1",
          size: null,
          offset: 77,
          metadata: { ss_ip: "1.2.3.4", ss_user: "", ss_auth: "0" },
        }
      );

      expect(libs.generateSafeFilename).toHaveBeenCalledWith("upload", "share-1", {
        unique: false,
      });
      expect(libs.createFileShareRecord).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { isBulk: false, size: 77 }
      );
    });

    it("creates a bulk share for the first file of a bulk upload", async () => {
      const result = await hooks.onUploadFinish(
        {},
        finishedUpload({ metadata: { ...finishedUpload().metadata, isBulk: "true" } })
      );

      expect(libs.createFileShareRecord).toHaveBeenCalledWith(expect.anything(), userContext, {
        isBulk: true,
        size: 100,
      });
      expect(libs.generateSafeFilename).toHaveBeenCalledWith("file.txt", "share-1", {
        unique: true,
      });
      expect(result.headers["X-Is-Bulk"]).toBe("true");
    });

    describe("subsequent file of a bulk share", () => {
      const bulkUpload = (metadata = {}) =>
        finishedUpload({
          metadata: {
            ...finishedUpload().metadata,
            isBulk: "true",
            bulkShareId: "bulk-1",
            relativePath: "dir/file.txt",
            ...metadata,
          },
        });

      it("adds the file to the existing share owned by the user", async () => {
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "bulk-slug",
          isBulk: true,
          ownerId: "user-1",
          expiresAt: null,
        });
        libs.generateSafeFilename.mockReturnValue("bulk-1_file_abc.txt");

        const result = await hooks.onUploadFinish({}, bulkUpload());

        expect(libs.prisma.share.findUnique).toHaveBeenCalledWith({ where: { id: "bulk-1" } });
        expect(libs.createFileShareRecord).not.toHaveBeenCalled();
        expect(libs.generateSafeFilename).toHaveBeenCalledWith("file.txt", "bulk-1", {
          unique: true,
        });
        expect(libs.prisma.shareFile.create).toHaveBeenCalledWith({
          data: {
            shareId: "bulk-1",
            filePath: "bulk-1_file_abc.txt",
            originalName: "file.txt",
            relativePath: "dir/file.txt",
            size: BigInt(100),
            mimeType: "text/plain",
          },
        });
        expect(libs.prisma.share.update).not.toHaveBeenCalled();
        // The share already exists: no creation event, no rollback
        expect(libs.emitShareEvent).not.toHaveBeenCalled();
        expect(libs.rollbackShare).not.toHaveBeenCalled();
        expect(result.headers).toMatchObject({
          "X-Share-Id": "bulk-1",
          "X-Share-Slug": "bulk-slug",
          "X-Is-Bulk": "true",
        });
      });

      it("defaults the mime type and relative path", async () => {
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "bulk-slug",
          isBulk: true,
          ownerId: "user-1",
        });

        await hooks.onUploadFinish(
          {},
          bulkUpload({ filetype: undefined, relativePath: undefined })
        );

        expect(libs.prisma.shareFile.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            relativePath: "file.txt",
            mimeType: "application/octet-stream",
          }),
        });
      });

      it("answers 404 when the share does not exist", async () => {
        libs.prisma.share.findUnique.mockResolvedValue(null);

        const error = await rejection(hooks.onUploadFinish({}, bulkUpload()));

        expect(error.status_code).toBe(404);
        expect(JSON.parse(error.body as string)).toEqual({ error: "SHARE_NOT_FOUND" });
        expect(libs.moveToStorage).not.toHaveBeenCalled();
        expect(libs.rollbackShare).not.toHaveBeenCalled();
      });

      it("answers 404 when the share is not a bulk share", async () => {
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "s",
          isBulk: false,
          ownerId: "user-1",
        });

        const error = await rejection(hooks.onUploadFinish({}, bulkUpload()));

        expect(error.status_code).toBe(404);
      });

      it("answers 403 when the share belongs to another user", async () => {
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "s",
          isBulk: true,
          ownerId: "someone-else",
        });

        const error = await rejection(hooks.onUploadFinish({}, bulkUpload()));

        expect(error.status_code).toBe(403);
        expect(JSON.parse(error.body as string)).toEqual({ error: "UNAUTHORIZED_SHARE_ACCESS" });
        expect(libs.moveToStorage).not.toHaveBeenCalled();
      });

      it("answers 403 to an anonymous uploader on the same IP as a user-owned share", async () => {
        // Behind a NAT the owner and an anonymous uploader share an IP: the IP only identifies the
        // uploader of a share that has no owner
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "s",
          isBulk: true,
          ownerId: "user-1",
          ipSource: "1.2.3.4",
        });

        await expect(
          hooks.onUploadFinish({}, bulkUpload({ ss_user: "", ss_auth: "0" }))
        ).rejects.toMatchObject({ status_code: 403 });
      });

      it("accepts an anonymous uploader from the same IP as the share", async () => {
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "bulk-slug",
          isBulk: true,
          ownerId: null,
          ipSource: "1.2.3.4",
        });

        const result = await hooks.onUploadFinish({}, bulkUpload({ ss_user: "", ss_auth: "0" }));

        expect(result.headers["X-Share-Id"]).toBe("bulk-1");
        expect(libs.prisma.shareFile.create).toHaveBeenCalled();
      });

      it("answers 403 to an anonymous uploader from another IP", async () => {
        libs.prisma.share.findUnique.mockResolvedValue({
          id: "bulk-1",
          slug: "s",
          isBulk: true,
          ownerId: null,
          ipSource: "8.8.8.8",
        });

        const error = await rejection(
          hooks.onUploadFinish({}, bulkUpload({ ss_user: "", ss_auth: "0" }))
        );

        expect(error.status_code).toBe(403);
      });
    });

    it("rolls back a freshly created share when moving the file fails", async () => {
      await createTusFiles();
      libs.moveToStorage.mockRejectedValue(new Error("disk full"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(libs.rollbackShare).toHaveBeenCalledWith("share-1");
      expect(error.status_code).toBe(500);
      // The upload is complete and can never be finalized again: it must not stay resumable
      expect(await readdir(tusTempDir)).toEqual([]);
    });

    it("deletes the stored file and rolls back the share when linking fails", async () => {
      libs.prisma.share.update.mockRejectedValue(new Error("db down"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(libs.deleteFromStorage).toHaveBeenCalledWith("share-1_file.txt");
      expect(libs.rollbackShare).toHaveBeenCalledWith("share-1");
      expect(libs.emitShareEvent).not.toHaveBeenCalled();
      expect(error.status_code).toBe(500);
    });

    it("rethrows the original error even when removing the stored file fails", async () => {
      libs.prisma.share.update.mockRejectedValue(new Error("db down"));
      libs.deleteFromStorage.mockRejectedValue(new Error("s3 down"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(error.status_code).toBe(500);
      expect(libs.rollbackShare).toHaveBeenCalledWith("share-1");
      expect(console.error).toHaveBeenCalledWith(
        "[Upload] Failed to remove unreferenced %s:",
        "share-1_file.txt",
        expect.any(Error)
      );
    });

    it("does not roll back a share it did not create when linking a bulk file fails", async () => {
      libs.prisma.share.findUnique.mockResolvedValue({
        id: "bulk-1",
        slug: "s",
        isBulk: true,
        ownerId: "user-1",
      });
      libs.prisma.shareFile.create.mockRejectedValue(new Error("db down"));

      await rejection(
        hooks.onUploadFinish(
          {},
          finishedUpload({
            metadata: { ...finishedUpload().metadata, isBulk: "true", bulkShareId: "bulk-1" },
          })
        )
      );

      expect(libs.deleteFromStorage).toHaveBeenCalled();
      expect(libs.rollbackShare).not.toHaveBeenCalled();
    });

    it("removes the tus files when the upload is rejected with a status_code", async () => {
      await createTusFiles();
      libs.resolveUploadOptions.mockRejectedValue(tusError(409, "SLUG_TAKEN"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(error.status_code).toBe(409);
      expect(await readdir(tusTempDir)).toEqual([]);
    });

    it("removes the tus files when the upload is rejected with an UploadError", async () => {
      await createTusFiles();
      libs.resolveUploadOptions.mockRejectedValue(new FakeUploadError(400, "SLUG_INVALID"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(error.status_code).toBe(400);
      expect(JSON.parse(error.body as string)).toEqual({ error: "SLUG_INVALID" });
      expect(await readdir(tusTempDir)).toEqual([]);
      // Nothing was created yet
      expect(libs.rollbackShare).not.toHaveBeenCalled();
    });

    it("removes the tus files when the failure is a crash", async () => {
      await createTusFiles();
      libs.resolveUploadOptions.mockRejectedValue(new Error("boom"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(error.status_code).toBe(500);
      expect(await readdir(tusTempDir)).toEqual([]);
    });

    it("does not fail when the tus files are already gone after a rejection", async () => {
      libs.resolveUploadOptions.mockRejectedValue(tusError(409, "SLUG_TAKEN"));

      const error = await rejection(hooks.onUploadFinish({}, finishedUpload()));

      expect(error.status_code).toBe(409);
      expect(console.error).not.toHaveBeenCalledWith(
        "[Upload] Failed to remove %s:",
        expect.anything(),
        expect.anything()
      );
    });

    describe("deferred-length uploads", () => {
      const deferredUpload = (size: number) => finishedUpload({ size });

      it("checks the limits on finish and accepts a size within them", async () => {
        const result = await hooks.onUploadFinish({}, deferredUpload(500));

        expect(libs.getUploadLimits).toHaveBeenCalledWith("1.2.3.4", true);
        expect(result.headers["X-Share-Id"]).toBe("share-1");
      });

      it("rejects a size above the limit and cleans up the tus files", async () => {
        await createTusFiles();

        const error = await rejection(hooks.onUploadFinish({}, deferredUpload(2000)));

        expect(error.status_code).toBe(413);
        expect(libs.createFileShareRecord).not.toHaveBeenCalled();
        expect(libs.moveToStorage).not.toHaveBeenCalled();
        expect(await readdir(tusTempDir)).toEqual([]);
      });

      it("rejects a size above the remaining quota with a 429", async () => {
        libs.getUploadLimits.mockResolvedValue({
          maxFileSizeBytes: 10_000,
          remainingQuotaBytes: 10,
        });

        const error = await rejection(hooks.onUploadFinish({}, deferredUpload(11)));

        expect(error.status_code).toBe(429);
      });

      it("checks the limits again when they already passed at creation", async () => {
        // Other shares may have been stored between creation and finish
        libs.getUploadLimits.mockResolvedValue({
          maxFileSizeBytes: 10_000,
          remainingQuotaBytes: 50,
        });

        const error = await rejection(hooks.onUploadFinish({}, finishedUpload({ size: 80 })));

        expect(libs.getUploadLimits).toHaveBeenCalledWith("1.2.3.4", true);
        expect(error.status_code).toBe(429);
        expect(libs.createFileShareRecord).not.toHaveBeenCalled();
      });
    });
  });
});
