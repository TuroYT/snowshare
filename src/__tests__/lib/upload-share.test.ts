/**
 * @jest-environment node
 */

jest.mock("node:fs/promises", () => ({
  rename: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/settings", () => ({
  getSettingsCached: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  isS3Enabled: jest.fn(),
  uploadToStorage: jest.fn(),
}));

jest.mock("@/lib/ip-geolocation", () => ({
  lookupIpGeolocation: jest.fn(),
}));

jest.mock("@/lib/security", () => ({
  ...jest.requireActual("@/lib/security"),
  hashPassword: jest.fn(async (p: string) => `hashed:${p}`),
  generateRandomSlug: jest.fn(),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import path from "node:path";
import { rename, unlink } from "node:fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
import { isS3Enabled, uploadToStorage } from "@/lib/storage";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import { generateRandomSlug, hashPassword, MAX_ANON_EXPIRY_DAYS } from "@/lib/security";
import { ErrorCode } from "@/lib/api-errors";
import { MultipartError, type MultipartErrorKind } from "@/lib/multipart-upload";
import { getUploadDir, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import {
  assertFileUploadAllowed,
  createFileShareRecord,
  MAX_NOTE_LENGTH,
  moveToStorage,
  resolveUploadOptions,
  rollbackShare,
  UploadError,
  uploadErrorResponse,
  validateUploadOptions,
  type ResolvedUploadOptions,
  type UploadContext,
} from "@/lib/upload-share";

const mockFindUnique = prisma.share.findUnique as jest.Mock;
const mockCreate = prisma.share.create as jest.Mock;
const mockDelete = prisma.share.delete as jest.Mock;
const mockSettings = getSettingsCached as jest.Mock;
const mockIsS3 = isS3Enabled as jest.Mock;
const mockUploadToStorage = uploadToStorage as jest.Mock;
const mockRename = rename as jest.Mock;
const mockUnlink = unlink as jest.Mock;
const mockLookup = lookupIpGeolocation as jest.Mock;
const mockRandomSlug = generateRandomSlug as jest.Mock;
const mockHash = hashPassword as jest.Mock;

const ANON: UploadContext = { clientIp: "1.2.3.4", userId: null, isAuthenticated: false };
const USER: UploadContext = { clientIp: "1.2.3.4", userId: "user-1", isAuthenticated: true };

function req(): NextRequest {
  return new NextRequest("http://localhost/api/upload", { method: "POST" });
}

describe("upload-share", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockUnlink.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue({});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("UploadError", () => {
    it("carries status, code and params", () => {
      const error = new UploadError(429, ErrorCode.IP_QUOTA_EXCEEDED, { quota: 5 });
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("UploadError");
      expect(error.status).toBe(429);
      expect(error.code).toBe(ErrorCode.IP_QUOTA_EXCEEDED);
      expect(error.params).toEqual({ quota: 5 });
      expect(error.message).toBe(ErrorCode.IP_QUOTA_EXCEEDED);
    });
  });

  describe("assertFileUploadAllowed", () => {
    it("does nothing for authenticated users without reading settings", async () => {
      await expect(assertFileUploadAllowed(USER)).resolves.toBeUndefined();
      expect(mockSettings).not.toHaveBeenCalled();
    });

    it("rejects anonymous uploads when anonymous file sharing is disabled", async () => {
      mockSettings.mockResolvedValue({ allowAnonFileShare: false });
      await expect(assertFileUploadAllowed(ANON)).rejects.toMatchObject({
        status: 403,
        code: ErrorCode.ANON_FILE_SHARE_DISABLED,
      });
    });

    it("allows anonymous uploads when enabled", async () => {
      mockSettings.mockResolvedValue({ allowAnonFileShare: true });
      await expect(assertFileUploadAllowed(ANON)).resolves.toBeUndefined();
    });

    it("allows anonymous uploads when settings are missing", async () => {
      mockSettings.mockResolvedValue(null);
      await expect(assertFileUploadAllowed(ANON)).resolves.toBeUndefined();
    });
  });

  describe("validateUploadOptions", () => {
    it("returns empty defaults for an authenticated user with no options", async () => {
      await expect(validateUploadOptions({}, USER)).resolves.toEqual({
        slug: null,
        password: null,
        expiresAt: null,
        maxViews: null,
        note: null,
      });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("rejects an invalid slug", async () => {
      await expect(validateUploadOptions({ slug: "a b" }, USER)).rejects.toMatchObject({
        status: 400,
        code: ErrorCode.SLUG_INVALID,
      });
    });

    it("rejects a slug already taken", async () => {
      mockFindUnique.mockResolvedValue({ id: "x" });
      await expect(validateUploadOptions({ slug: "taken" }, USER)).rejects.toMatchObject({
        status: 409,
        code: ErrorCode.SLUG_ALREADY_TAKEN,
      });
    });

    it("trims a valid slug and checks availability", async () => {
      const result = await validateUploadOptions({ slug: "  my-slug  " }, USER);
      expect(result.slug).toBe("my-slug");
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { slug: "my-slug" },
        select: { id: true },
      });
    });

    it("skips the availability check when disabled", async () => {
      await validateUploadOptions({ slug: "my-slug" }, USER, { checkSlugAvailability: false });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("parses a valid expiration date for authenticated users", async () => {
      const result = await validateUploadOptions({ expiresAt: "2030-01-01T00:00:00.000Z" }, USER);
      expect(result.expiresAt).toEqual(new Date("2030-01-01T00:00:00.000Z"));
    });

    it("accepts a Date instance as expiration", async () => {
      const date = new Date("2031-05-05T00:00:00.000Z");
      const result = await validateUploadOptions({ expiresAt: date }, USER);
      expect(result.expiresAt).toEqual(date);
    });

    it("rejects an invalid date in reject mode", async () => {
      await expect(validateUploadOptions({ expiresAt: "not-a-date" }, USER)).rejects.toMatchObject({
        status: 400,
        code: ErrorCode.INVALID_DATE_FORMAT,
      });
    });

    it("ignores an invalid date in clamp mode", async () => {
      const result = await validateUploadOptions({ expiresAt: "not-a-date" }, USER, {
        anonExpiry: "clamp",
      });
      expect(result.expiresAt).toBeNull();
    });

    it("defaults anonymous expiration to the maximum", async () => {
      const before = Date.now();
      const result = await validateUploadOptions({}, ANON);
      const expected = before + MAX_ANON_EXPIRY_DAYS * 24 * 3600 * 1000;
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(Math.abs(result.expiresAt!.getTime() - expected)).toBeLessThan(2 * 3600 * 1000 + 5000);
    });

    it("keeps an anonymous expiration within the maximum", async () => {
      const soon = new Date(Date.now() + 3600 * 1000);
      const result = await validateUploadOptions({ expiresAt: soon.toISOString() }, ANON);
      expect(result.expiresAt).toEqual(soon);
    });

    it("rejects an anonymous expiration that is too far in reject mode", async () => {
      const far = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
      await expect(validateUploadOptions({ expiresAt: far }, ANON)).rejects.toMatchObject({
        status: 400,
        code: ErrorCode.EXPIRATION_TOO_FAR,
        params: { days: MAX_ANON_EXPIRY_DAYS },
      });
    });

    it("clamps an anonymous expiration that is too far in clamp mode", async () => {
      const far = new Date(Date.now() + 365 * 24 * 3600 * 1000);
      const result = await validateUploadOptions({ expiresAt: far }, ANON, {
        anonExpiry: "clamp",
      });
      expect(result.expiresAt!.getTime()).toBeLessThan(far.getTime());
    });

    it("rejects passwords that are too short or too long", async () => {
      const tooShort = "a".repeat(PASSWORD_MIN_LENGTH - 1);
      const tooLong = "a".repeat(PASSWORD_MAX_LENGTH + 1);
      await expect(validateUploadOptions({ password: tooShort }, USER)).rejects.toMatchObject({
        code: ErrorCode.PASSWORD_INVALID_LENGTH,
        params: { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH },
      });
      await expect(validateUploadOptions({ password: tooLong }, USER)).rejects.toMatchObject({
        code: ErrorCode.PASSWORD_INVALID_LENGTH,
      });
    });

    it("accepts and trims a valid password", async () => {
      const result = await validateUploadOptions({ password: "  secret123  " }, USER);
      expect(result.password).toBe("secret123");
    });

    it("treats a blank password as none", async () => {
      const result = await validateUploadOptions({ password: "   " }, USER);
      expect(result.password).toBeNull();
    });

    it.each([
      ["5", 5],
      [7, 7],
      ["0", null],
      [0, null],
      ["abc", null],
      [-3, null],
      [1.5, null],
      [null, null],
      [undefined, null],
    ])("parses maxViews %p as %p", async (raw, expected) => {
      const result = await validateUploadOptions({ maxViews: raw as string | number }, USER);
      expect(result.maxViews).toBe(expected);
    });

    it("truncates the note to the maximum length and nulls empty notes", async () => {
      const long = "n".repeat(MAX_NOTE_LENGTH + 50);
      const result = await validateUploadOptions({ note: long }, USER);
      expect(result.note).toHaveLength(MAX_NOTE_LENGTH);
      const empty = await validateUploadOptions({ note: "" }, USER);
      expect(empty.note).toBeNull();
    });
  });

  describe("resolveUploadOptions", () => {
    it("hashes the password and renames it to passwordHash", async () => {
      const result = await resolveUploadOptions({ slug: "abc", password: "secret123" }, USER);
      expect(mockHash).toHaveBeenCalledWith("secret123");
      expect(result.passwordHash).toBe("hashed:secret123");
      expect(result).not.toHaveProperty("password");
      expect(result.slug).toBe("abc");
    });

    it("returns a null hash without password and forwards validation options", async () => {
      const result = await resolveUploadOptions({ slug: "abc" }, USER, {
        checkSlugAvailability: false,
      });
      expect(result.passwordHash).toBeNull();
      expect(mockHash).not.toHaveBeenCalled();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("createFileShareRecord", () => {
    const options: ResolvedUploadOptions = {
      slug: "my-slug",
      passwordHash: "hash",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      maxViews: 3,
      note: "hello",
    };

    it("creates a single file share with the given slug and size", async () => {
      mockCreate.mockResolvedValue({ id: "s1", slug: "my-slug" });
      const share = await createFileShareRecord(options, USER, { isBulk: false, size: 42 });
      expect(share).toEqual({ id: "s1", slug: "my-slug" });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          slug: "my-slug",
          type: "FILE",
          filePath: "",
          size: BigInt(42),
          password: "hash",
          expiresAt: options.expiresAt,
          ipSource: "1.2.3.4",
          ownerId: "user-1",
          isBulk: false,
          maxViews: 3,
          note: "hello",
        },
      });
      expect(mockLookup).toHaveBeenCalledWith("1.2.3.4");
      expect(mockRandomSlug).not.toHaveBeenCalled();
    });

    it("creates a bulk share without path or size", async () => {
      mockCreate.mockResolvedValue({ id: "s2" });
      await createFileShareRecord(options, USER, { isBulk: true, size: 42 });
      const data = mockCreate.mock.calls[0][0].data;
      expect(data.filePath).toBeNull();
      expect(data.size).toBeNull();
      expect(data.isBulk).toBe(true);
    });

    it("stores a null size when none is given", async () => {
      mockCreate.mockResolvedValue({ id: "s3" });
      await createFileShareRecord(options, ANON, { isBulk: false });
      const data = mockCreate.mock.calls[0][0].data;
      expect(data.size).toBeNull();
      expect(data.ownerId).toBeNull();
    });

    it("generates a random slug and checks for collisions", async () => {
      mockRandomSlug.mockImplementation(async (exists: (s: string) => Promise<boolean>) => {
        await exists("candidate");
        return "generated";
      });
      mockFindUnique.mockResolvedValue({ id: "other" });
      mockCreate.mockResolvedValue({ id: "s4" });
      await createFileShareRecord({ ...options, slug: null }, USER, { isBulk: false, size: 1 });
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { slug: "candidate" },
        select: { id: true },
      });
      expect(mockCreate.mock.calls[0][0].data.slug).toBe("generated");
    });

    it("maps a unique constraint violation to SLUG_ALREADY_TAKEN", async () => {
      mockCreate.mockRejectedValue({ code: "P2002" });
      await expect(
        createFileShareRecord(options, USER, { isBulk: false, size: 1 })
      ).rejects.toMatchObject({ status: 409, code: ErrorCode.SLUG_ALREADY_TAKEN });
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it("rethrows other database errors", async () => {
      const failure = new Error("db down");
      mockCreate.mockRejectedValue(failure);
      await expect(createFileShareRecord(options, USER, { isBulk: false })).rejects.toBe(failure);
    });

    it("rethrows non-object errors", async () => {
      mockCreate.mockRejectedValue("boom");
      await expect(createFileShareRecord(options, USER, { isBulk: false })).rejects.toBe("boom");
    });
  });

  describe("moveToStorage", () => {
    it("renames the file into the upload directory when S3 is disabled", async () => {
      mockIsS3.mockResolvedValue(false);
      await moveToStorage("/tmp/x/temp", "abc_file.txt");
      expect(mockRename).toHaveBeenCalledWith(
        "/tmp/x/temp",
        path.join(getUploadDir(), "abc_file.txt")
      );
      expect(mockUploadToStorage).not.toHaveBeenCalled();
    });

    it("uploads to S3 then removes the local file", async () => {
      mockIsS3.mockResolvedValue(true);
      await moveToStorage("/tmp/x/temp", "abc_file.txt");
      expect(mockUploadToStorage).toHaveBeenCalledWith("/tmp/x/temp", "abc_file.txt");
      expect(mockUnlink).toHaveBeenCalledWith("/tmp/x/temp");
      expect(mockRename).not.toHaveBeenCalled();
    });

    it("logs but does not throw when the local cleanup after S3 fails", async () => {
      mockIsS3.mockResolvedValue(true);
      mockUnlink.mockRejectedValue(new Error("EPERM"));
      await expect(moveToStorage("/tmp/x/temp", "k")).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("rollbackShare", () => {
    it("deletes the share", async () => {
      await rollbackShare("s1");
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "s1" } });
    });

    it("logs but does not throw when the deletion fails", async () => {
      mockDelete.mockRejectedValue(new Error("gone"));
      await expect(rollbackShare("s1")).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("uploadErrorResponse", () => {
    const limits = { maxFileSizeBytes: 10 * 1024 * 1024, ipQuotaBytes: 100 * 1024 * 1024 };

    async function run(error: unknown, withLimits = true) {
      const response = uploadErrorResponse(req(), error, withLimits ? limits : undefined);
      return { status: response.status, body: await response.json() };
    }

    it("uses the status and code of an UploadError", async () => {
      const { status, body } = await run(new UploadError(403, ErrorCode.ANON_FILE_SHARE_DISABLED));
      expect(status).toBe(403);
      expect(body.code).toBe(ErrorCode.ANON_FILE_SHARE_DISABLED);
    });

    it.each<[MultipartErrorKind, number, ErrorCode]>([
      ["FILE_TOO_LARGE", 413, ErrorCode.FILE_TOO_LARGE],
      ["TOTAL_TOO_LARGE", 429, ErrorCode.IP_QUOTA_EXCEEDED],
      ["TOO_MANY_FILES", 400, ErrorCode.TOO_MANY_FILES],
      ["INVALID_FILENAME", 400, ErrorCode.FILENAME_INVALID],
    ])("maps MultipartError %s to %i", async (kind, expectedStatus, code) => {
      const { status, body } = await run(new MultipartError(kind));
      expect(status).toBe(expectedStatus);
      expect(body.code).toBe(code);
    });

    it("handles size errors without limits", async () => {
      expect((await run(new MultipartError("FILE_TOO_LARGE"), false)).status).toBe(413);
      expect((await run(new MultipartError("TOTAL_TOO_LARGE"), false)).status).toBe(429);
    });

    it("maps other multipart errors to INVALID_REQUEST and logs the cause", async () => {
      const cause = new Error("bad stream");
      const { status, body } = await run(new MultipartError("MALFORMED", { cause }));
      expect(status).toBe(400);
      expect(body.code).toBe(ErrorCode.INVALID_REQUEST);
      expect(errorSpy).toHaveBeenCalledWith("Upload: malformed multipart request:", cause);
    });

    it("logs the error itself when a malformed multipart error has no cause", async () => {
      const error = new MultipartError("MALFORMED");
      await run(error);
      expect(errorSpy).toHaveBeenCalledWith("Upload: malformed multipart request:", error);
    });

    it("returns a 500 for unexpected errors", async () => {
      const { status, body } = await run(new Error("boom"));
      expect(status).toBe(500);
      expect(body.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
