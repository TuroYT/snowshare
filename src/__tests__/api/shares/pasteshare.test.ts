/**
 * @jest-environment node
 */

/**
 * Tests for paste share functionality
 */

// Mock external dependencies before imports
jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    settings: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  isValidSlug: jest.requireActual("@/lib/security").isValidSlug,
  resolveAnonExpiry: jest.requireActual("@/lib/security").resolveAnonExpiry,
  MAX_ANON_EXPIRY_DAYS: 7,
}));

jest.mock("@/lib/ip-geolocation", () => ({
  lookupIpGeolocation: jest.fn(),
}));

import { createPasteShare } from "@/app/api/shares/(pasteShare)/pasteshareshare";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security";
import { NextRequest } from "next/server";
import { ErrorCode } from "@/lib/api-errors";

const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaCreate = prisma.share.create as jest.Mock;
const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockPrismaSettingsFindFirst = prisma.settings.findFirst as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;

function makeRequest(): NextRequest {
  return {
    headers: { get: () => null },
    nextUrl: { searchParams: { get: () => null } },
    cookies: { get: () => null },
  } as unknown as NextRequest;
}

describe("createPasteShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
    mockPrismaFindUnique.mockResolvedValue(null);
    mockPrismaCreate.mockResolvedValue({
      id: "share-456",
      slug: "paste123",
      type: "PASTE",
      paste: 'console.log("Hello")',
      pastelanguage: "JAVASCRIPT",
    });
  });

  describe("paste content validation", () => {
    it("should reject empty paste content", async () => {
      const result = await createPasteShare("", "JAVASCRIPT", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.PASTE_CONTENT_EMPTY);
    });

    it("should reject null paste content", async () => {
      const result = await createPasteShare(null as unknown as string, "JAVASCRIPT", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.PASTE_CONTENT_EMPTY);
    });

    it("should accept valid paste content", async () => {
      const result = await createPasteShare('console.log("Hello")', "JAVASCRIPT", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should accept long paste content", async () => {
      const longContent = "a".repeat(10000);
      const result = await createPasteShare(longContent, "PLAINTEXT", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should accept code with special characters", async () => {
      const code = `function test() {
        const obj = { key: "value", arr: [1, 2, 3] };
        return obj?.arr?.length ?? 0;
      }`;
      const result = await createPasteShare(code, "JAVASCRIPT", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe("language validation", () => {
    it("should reject empty language", async () => {
      const result = await createPasteShare("code", "", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("should reject null language", async () => {
      const result = await createPasteShare("code", null as unknown as string, makeRequest());
      expect(result.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("should reject an unknown language", async () => {
      const result = await createPasteShare("code", "COBOL", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("should accept valid language", async () => {
      const result = await createPasteShare('print("Hello")', "PYTHON", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should accept all valid programming languages", async () => {
      const languages = [
        "JAVASCRIPT",
        "TYPESCRIPT",
        "PYTHON",
        "JAVA",
        "PHP",
        "GO",
        "HTML",
        "CSS",
        "SQL",
        "JSON",
        "MARKDOWN",
        "PLAINTEXT",
      ];

      for (const lang of languages) {
        mockPrismaCreate.mockResolvedValue({
          id: `share-${lang}`,
          slug: `slug-${lang}`,
          type: "PASTE",
          paste: "code",
          pastelanguage: lang,
        });

        const result = await createPasteShare("code", lang, makeRequest());
        expect(result.errorCode).toBeUndefined();
        expect(result.pasteShare).toBeDefined();
      }
    });
  });

  describe("slug validation", () => {
    it("should reject slug shorter than 3 characters", async () => {
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), undefined, "ab");
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should reject slug longer than 30 characters", async () => {
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        "a".repeat(31)
      );
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should reject slug with special characters", async () => {
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        "my@slug"
      );
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should accept valid slug", async () => {
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        "my-paste_123"
      );
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should reject an already-taken slug", async () => {
      mockPrismaFindUnique.mockResolvedValueOnce({ id: "existing" });
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        "taken-slug"
      );
      expect(result.errorCode).toBe(ErrorCode.SLUG_ALREADY_TAKEN);
    });

    it("should generate slug if not provided", async () => {
      await createPasteShare("code", "JAVASCRIPT", makeRequest());
      expect(mockPrismaCreate).toHaveBeenCalled();
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.slug).toBeDefined();
    });
  });

  describe("expiration date validation", () => {
    it("should reject expiration date in the past", async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), pastDate);
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_IN_PAST);
    });

    it("should accept expiration date in the future", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), futureDate);
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe("password validation", () => {
    it("should reject password shorter than 6 characters", async () => {
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        undefined,
        "abc"
      );
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("should reject password longer than 100 characters", async () => {
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        undefined,
        "a".repeat(101)
      );
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("should hash password when provided", async () => {
      const result = await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        undefined,
        "validpassword"
      );

      expect(mockHashPassword).toHaveBeenCalledWith("validpassword");
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should allow paste without password", async () => {
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest());
      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should store hashed password, not plaintext", async () => {
      await createPasteShare(
        "code",
        "JAVASCRIPT",
        makeRequest(),
        undefined,
        undefined,
        "mypassword"
      );

      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.password).toBe("hashed_mypassword");
      expect(createArgs.data.password).not.toBe("mypassword");
    });
  });

  describe("anonymous user restrictions", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(null);
    });

    it("should require expiration date for anonymous users", async () => {
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_REQUIRED);
    });

    it("should reject expiration beyond 7 days for anonymous users", async () => {
      const beyondMax = new Date(Date.now() + 8 * 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), beyondMax);
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_TOO_FAR);
    });

    it("should allow expiration within 7 days for anonymous users", async () => {
      const withinMax = new Date(Date.now() + 5 * 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), withinMax);
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should reject when allowAnonPasteShare is false", async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({ allowAnonPasteShare: false });
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), futureDate);
      expect(result.errorCode).toBe(ErrorCode.ANON_PASTE_SHARE_DISABLED);
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    it("should allow when allowAnonPasteShare is true", async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({ allowAnonPasteShare: true });
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), futureDate);
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should allow when settings are null (default behavior)", async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue(null);
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), futureDate);
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe("authenticated user", () => {
    it("should allow creating paste without expiration date", async () => {
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should allow expiration beyond 7 days", async () => {
      const farFuture = new Date(Date.now() + 365 * 86400000);
      const result = await createPasteShare("code", "JAVASCRIPT", makeRequest(), farFuture);
      expect(result.errorCode).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it("should associate paste with user", async () => {
      await createPasteShare("code", "JAVASCRIPT", makeRequest());
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.ownerId).toBe("user-123");
    });
  });

  describe("database operations", () => {
    it("should create paste with correct data", async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      await createPasteShare(
        'console.log("test")',
        "JAVASCRIPT",
        makeRequest(),
        expiresAt,
        "my-paste"
      );

      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "PASTE",
          paste: 'console.log("test")',
          pastelanguage: "JAVASCRIPT",
          slug: "my-paste",
          ownerId: "user-123",
        }),
      });
    });
  });
});
