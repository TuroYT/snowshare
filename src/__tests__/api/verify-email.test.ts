/**
 * @jest-environment node
 */

/**
 * Tests for the email verification API endpoint (GET /api/auth/verify-email)
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { GET } from "@/app/api/auth/verify-email/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const mockTokenFindFirst = prisma.verificationToken.findUnique as jest.Mock;
const mockTokenDelete = prisma.verificationToken.delete as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/auth/verify-email");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return {
    url: url.toString(),
    headers: { get: jest.fn().mockReturnValue(null) },
  } as unknown as NextRequest;
}

const FUTURE = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
const PAST = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenDelete.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});
  });

  describe("parameter validation", () => {
    it("should return 400 when token is missing", async () => {
      const req = makeRequest({ email: "user@example.com" });
      const response = await GET(req);

      expect(response.status).toBe(400);
    });

    it("should return 400 when email is missing", async () => {
      const req = makeRequest({ token: "some-token" });
      const response = await GET(req);

      expect(response.status).toBe(400);
    });

    it("should return 400 when both token and email are missing", async () => {
      const req = makeRequest({});
      const response = await GET(req);

      expect(response.status).toBe(400);
    });
  });

  describe("token validation", () => {
    it("should return 400 when token is not found in the database", async () => {
      mockTokenFindFirst.mockResolvedValue(null);

      const req = makeRequest({ token: "nonexistent-token", email: "user@example.com" });
      const response = await GET(req);

      expect(response.status).toBe(400);
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should return 400 and delete the token when token is expired", async () => {
      mockTokenFindFirst.mockResolvedValue({
        identifier: "email-verify:user@example.com",
        token: "expired-token",
        expires: PAST,
      });

      const req = makeRequest({ token: "expired-token", email: "user@example.com" });
      const response = await GET(req);

      expect(response.status).toBe(400);
      expect(mockTokenDelete).toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("successful verification", () => {
    beforeEach(() => {
      mockTokenFindFirst.mockResolvedValue({
        identifier: "email-verify:user@example.com",
        token: "valid-token",
        expires: FUTURE,
      });
      mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    });

    it("should return 200 and mark the user as verified", async () => {
      const req = makeRequest({ token: "valid-token", email: "user@example.com" });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "user@example.com" },
          data: expect.objectContaining({ emailVerified: expect.any(Date) }),
        })
      );
    });

    it("should delete the token after successful verification (one-time use)", async () => {
      const req = makeRequest({ token: "valid-token", email: "user@example.com" });
      await GET(req);

      expect(mockTokenDelete).toHaveBeenCalledWith({
        where: {
          identifier_token: {
            identifier: "email-verify:user@example.com",
            token: "valid-token",
          },
        },
      });
    });

    it("should look up the token using the correct identifier prefix", async () => {
      const req = makeRequest({ token: "valid-token", email: "user@example.com" });
      await GET(req);

      expect(mockTokenFindFirst).toHaveBeenCalledWith({
        where: {
          identifier_token: {
            identifier: "email-verify:user@example.com",
            token: "valid-token",
          },
        },
      });
    });

    it("should return 404 when user is not found for a valid token", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const req = makeRequest({ token: "valid-token", email: "user@example.com" });
      const response = await GET(req);

      expect(response.status).toBe(404);
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 500 on unexpected database error", async () => {
      mockTokenFindFirst.mockRejectedValue(new Error("DB failure"));

      const req = makeRequest({ token: "valid-token", email: "user@example.com" });
      const response = await GET(req);

      expect(response.status).toBe(500);
    });
  });
});
