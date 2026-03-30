/**
 * @jest-environment node
 */

/**
 * Tests for link share functionality
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

jest.mock("@/lib/crypto-link", () => ({
  encrypt: jest.fn((text: string, password: string) => `encrypted_${text}_${password}`),
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

import { createLinkShare } from "@/app/api/shares/(linkShare)/linkshare";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto-link";
import { hashPassword } from "@/lib/security";
import { NextRequest } from "next/server";
import { ErrorCode } from "@/lib/api-errors";

const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaCreate = prisma.share.create as jest.Mock;
const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockPrismaSettingsFindFirst = prisma.settings.findFirst as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;
const mockEncrypt = encrypt as jest.Mock;

function makeRequest(): NextRequest {
  return {
    headers: { get: () => null },
    nextUrl: { searchParams: { get: () => null } },
    cookies: { get: () => null },
  } as unknown as NextRequest;
}

describe("createLinkShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
    mockPrismaFindUnique.mockResolvedValue(null);
    mockPrismaCreate.mockResolvedValue({
      id: "share-123",
      slug: "abc123",
      type: "URL",
      urlOriginal: "https://example.com",
    });
  });

  describe("URL validation", () => {
    it("should reject empty URL", async () => {
      const result = await createLinkShare("", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.INVALID_URL);
    });

    it("should reject invalid URL format", async () => {
      const result = await createLinkShare("not a valid url", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.INVALID_URL);
    });

    it("should accept valid http URL", async () => {
      const result = await createLinkShare("http://example.com", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should accept valid https URL", async () => {
      const result = await createLinkShare("https://example.com", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should accept localhost URL", async () => {
      const result = await createLinkShare("http://localhost:3000", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should accept IP address URL", async () => {
      const result = await createLinkShare("http://192.168.1.1:8080/path", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe("slug validation", () => {
    it("should reject slug shorter than 3 characters", async () => {
      const result = await createLinkShare("https://example.com", makeRequest(), undefined, "ab");
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should reject slug longer than 30 characters", async () => {
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        "a".repeat(31)
      );
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should reject slug with special characters", async () => {
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        "my@slug"
      );
      expect(result.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("should accept valid slug with alphanumeric characters", async () => {
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        "my-slug_123"
      );
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should reject an already-taken slug", async () => {
      mockPrismaFindUnique.mockResolvedValueOnce({ id: "existing" });
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        "taken-slug"
      );
      expect(result.errorCode).toBe(ErrorCode.SLUG_ALREADY_TAKEN);
    });

    it("should generate slug if not provided", async () => {
      await createLinkShare("https://example.com", makeRequest());
      expect(mockPrismaCreate).toHaveBeenCalled();
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.slug).toBeDefined();
    });
  });

  describe("expiration date validation", () => {
    it("should reject expiration date in the past", async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), pastDate);
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_IN_PAST);
    });

    it("should accept expiration date in the future", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), futureDate);
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe("password validation", () => {
    it("should reject password shorter than 6 characters", async () => {
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        undefined,
        "abc"
      );
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("should reject password longer than 100 characters", async () => {
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        undefined,
        "a".repeat(101)
      );
      expect(result.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("should hash password and encrypt URL when password is provided", async () => {
      const result = await createLinkShare(
        "https://example.com",
        makeRequest(),
        undefined,
        undefined,
        "validpassword"
      );

      expect(mockHashPassword).toHaveBeenCalledWith("validpassword");
      expect(mockEncrypt).toHaveBeenCalledWith("https://example.com", "validpassword");
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe("anonymous user restrictions", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(null);
    });

    it("should require expiration date for anonymous users", async () => {
      const result = await createLinkShare("https://example.com", makeRequest());
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_REQUIRED);
    });

    it("should reject expiration beyond 7 days for anonymous users", async () => {
      const beyondMax = new Date(Date.now() + 8 * 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), beyondMax);
      expect(result.errorCode).toBe(ErrorCode.EXPIRATION_TOO_FAR);
    });

    it("should allow expiration within 7 days for anonymous users", async () => {
      const withinMax = new Date(Date.now() + 5 * 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), withinMax);
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should reject when allowAnonLinkShare is false", async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({ allowAnonLinkShare: false });
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), futureDate);
      expect(result.errorCode).toBe(ErrorCode.ANON_LINK_SHARE_DISABLED);
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    it("should allow when allowAnonLinkShare is true", async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({ allowAnonLinkShare: true });
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), futureDate);
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should allow when settings are null (default behavior)", async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue(null);
      const futureDate = new Date(Date.now() + 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), futureDate);
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe("authenticated user", () => {
    it("should allow creating share without expiration date", async () => {
      const result = await createLinkShare("https://example.com", makeRequest());
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should allow expiration beyond 7 days", async () => {
      const farFuture = new Date(Date.now() + 365 * 86400000);
      const result = await createLinkShare("https://example.com", makeRequest(), farFuture);
      expect(result.errorCode).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it("should associate share with user", async () => {
      await createLinkShare("https://example.com", makeRequest());
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.ownerId).toBe("user-123");
    });
  });

  describe("database operations", () => {
    it("should create share with correct data", async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      await createLinkShare("https://example.com", makeRequest(), expiresAt, "my-slug");

      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "URL",
          slug: "my-slug",
          ownerId: "user-123",
        }),
      });
    });
  });
});
