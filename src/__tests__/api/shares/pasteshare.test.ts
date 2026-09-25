/**
 * @jest-environment node
 */

/**
 * Tests for paste share functionality
 */

// Mock external dependencies before imports
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

jest.mock("@/lib/settings", () => ({
  getSettingsCached: jest.fn(),
}));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((password: string) => Promise.resolve(`hashed_${password}`)),
  isValidSlug: jest.requireActual("@/lib/security").isValidSlug,
  resolveAnonExpiry: jest.requireActual("@/lib/security").resolveAnonExpiry,
  generateRandomSlug: jest.requireActual("@/lib/security").generateRandomSlug,
  MAX_ANON_EXPIRY_DAYS: 7,
}));

jest.mock("@/lib/ip-geolocation", () => ({
  lookupIpGeolocation: jest.fn(),
}));

import { createPasteShare } from "@/lib/shares";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
import { hashPassword } from "@/lib/security";
import { ErrorCode } from "@/lib/api-errors";
import type { ShareContext } from "@/lib/shares";

const mockPrismaCreate = prisma.share.create as jest.Mock;
const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockGetSettingsCached = getSettingsCached as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;

const authContext: ShareContext = { userId: "user-123", isAuthenticated: true, ip: "127.0.0.1" };
const anonContext: ShareContext = { userId: null, isAuthenticated: false, ip: "127.0.0.1" };

describe("createPasteShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsCached.mockResolvedValue(null);
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
      const result = await createPasteShare({
        paste: "",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
      });
      expect(result.errorCode).toBe(ErrorCode.PASTE_CONTENT_EMPTY);
    });

    it("should reject null paste content", async () => {
      const result = await createPasteShare({
        paste: null as unknown as string,
        pastelanguage: "JAVASCRIPT",
        context: authContext,
      });
      expect(result.errorCode).toBe(ErrorCode.PASTE_CONTENT_EMPTY);
    });

    it("should accept valid paste content", async () => {
      const result = await createPasteShare({
        paste: 'console.log("Hello")',
        pastelanguage: "JAVASCRIPT",
        context: authContext,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should accept long paste content", async () => {
      const longContent = "a".repeat(10000);
      const result = await createPasteShare({
        paste: longContent,
        pastelanguage: "PLAINTEXT",
        context: authContext,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should accept code with special characters", async () => {
      const code = `function test() {
        const obj = { key: "value", arr: [1, 2, 3] };
        return obj?.arr?.length ?? 0;
      }`;
      const result = await createPasteShare({
        paste: code,
        pastelanguage: "JAVASCRIPT",
        context: authContext,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe("language validation", () => {
    it("should reject empty language", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "",
        context: authContext,
      });
      expect(result.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("should reject null language", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: null as unknown as string,
        context: authContext,
      });
      expect(result.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("should reject an unknown language", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "COBOL",
        context: authContext,
      });
      expect(result.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("should accept valid language", async () => {
      const result = await createPasteShare({
        paste: 'print("Hello")',
        pastelanguage: "PYTHON",
        context: authContext,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
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

        const result = await createPasteShare({
          paste: "code",
          pastelanguage: lang,
          context: authContext,
        });
        expect(result.errorCode).toBeUndefined();
        expect(result.share).toBeDefined();
      }
    });
  });

  describe("slug validation", () => {
    it("should reject slug shorter than 3 characters", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        slug: "ab",
      });
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should reject slug longer than 30 characters", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        slug: "a".repeat(31),
      });
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should reject slug with special characters", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        slug: "my@slug",
      });
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should accept valid slug", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        slug: "my-paste_123",
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should reject an already-taken slug", async () => {
      mockPrismaFindUnique.mockResolvedValueOnce({ id: "existing" });
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        slug: "taken-slug",
      });
      expect(result.errorCode).toBe(ErrorCode.SLUG_ALREADY_TAKEN);
    });

    it("should generate slug if not provided", async () => {
      await createPasteShare({ paste: "code", pastelanguage: "JAVASCRIPT", context: authContext });
      expect(mockPrismaCreate).toHaveBeenCalled();
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.slug).toBeDefined();
    });
  });

  describe("expiration date validation", () => {
    it("should reject expiration date in the past", async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        expiresAt: pastDate,
      });
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_IN_PAST);
    });

    it("should accept expiration date in the future", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        expiresAt: futureDate,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe("password validation", () => {
    it("should reject password shorter than 6 characters", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        password: "abc",
      });
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("should reject password longer than 100 characters", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        password: "a".repeat(101),
      });
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("should hash password when provided", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        password: "validpassword",
      });

      expect(mockHashPassword).toHaveBeenCalledWith("validpassword");
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should allow paste without password", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
      });
      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should store hashed password, not plaintext", async () => {
      await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        password: "mypassword",
      });

      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.password).toBe("hashed_mypassword");
      expect(createArgs.data.password).not.toBe("mypassword");
    });
  });

  describe("anonymous user restrictions", () => {
    it("should require expiration date for anonymous users", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: anonContext,
      });
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_REQUIRED);
    });

    it("should reject expiration beyond 7 days for anonymous users", async () => {
      const beyondMax = new Date(Date.now() + 8 * 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: anonContext,
        expiresAt: beyondMax,
      });
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_TOO_FAR);
    });

    it("should allow expiration within 7 days for anonymous users", async () => {
      const withinMax = new Date(Date.now() + 5 * 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: anonContext,
        expiresAt: withinMax,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should reject when allowAnonPasteShare is false", async () => {
      mockGetSettingsCached.mockResolvedValue({ allowAnonPasteShare: false });
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: anonContext,
        expiresAt: futureDate,
      });
      expect(result.errorCode).toBe(ErrorCode.ANON_PASTE_SHARE_DISABLED);
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    it("should allow when allowAnonPasteShare is true", async () => {
      mockGetSettingsCached.mockResolvedValue({ allowAnonPasteShare: true });
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: anonContext,
        expiresAt: futureDate,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should allow when settings are null (default behavior)", async () => {
      mockGetSettingsCached.mockResolvedValue(null);
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: anonContext,
        expiresAt: futureDate,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe("authenticated user", () => {
    it("should allow creating paste without expiration date", async () => {
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should allow expiration beyond 7 days", async () => {
      const farFuture = new Date(Date.now() + 365 * 86400000);
      const result = await createPasteShare({
        paste: "code",
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        expiresAt: farFuture,
      });
      expect(result.errorCode).toBeUndefined();
      expect(result.share).toBeDefined();
    });

    it("should associate paste with user", async () => {
      await createPasteShare({ paste: "code", pastelanguage: "JAVASCRIPT", context: authContext });
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.ownerId).toBe("user-123");
    });
  });

  describe("database operations", () => {
    it("should create paste with correct data", async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      await createPasteShare({
        paste: 'console.log("test")',
        pastelanguage: "JAVASCRIPT",
        context: authContext,
        expiresAt,
        slug: "my-paste",
      });

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
