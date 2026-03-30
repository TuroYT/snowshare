/**
 * @jest-environment node
 */

/**
 * Tests for user registration API route (POST /api/auth/register)
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    settings: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((password: string) => Promise.resolve(`hashed:${password}`)),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const mockUserCount = prisma.user.count as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockSettingsFindFirst = prisma.settings.findFirst as jest.Mock;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as NextRequest;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Defaults: signup enabled, first user
    mockUserCount.mockResolvedValue(0);
    mockSettingsFindFirst.mockResolvedValue({
      allowSignin: true,
      disableCredentialsLogin: false,
    });
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isAdmin: true,
    });
  });

  describe("first user registration", () => {
    it("should create the first user as admin", async () => {
      const req = makeRequest({
        email: "admin@example.com",
        password: "password123",
        isFirstUser: true,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isAdmin: true }),
        })
      );
    });

    it("should reject first-user registration when users already exist", async () => {
      mockUserCount.mockResolvedValue(1);

      const req = makeRequest({
        email: "admin@example.com",
        password: "password123",
        isFirstUser: true,
      });

      const response = await POST(req);
      expect(response.status).toBe(403);
    });
  });

  describe("subsequent user registration", () => {
    beforeEach(() => {
      mockUserCount.mockResolvedValue(1); // Already has users
    });

    it("should register a new user when signup is enabled", async () => {
      const req = makeRequest({
        email: "newuser@example.com",
        password: "password123",
      });
      mockUserCreate.mockResolvedValue({
        id: "user-2",
        email: "newuser@example.com",
        isAdmin: false,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.email).toBe("newuser@example.com");
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isAdmin: false }),
        })
      );
    });

    it("should reject registration when signup is disabled", async () => {
      mockSettingsFindFirst.mockResolvedValue({
        allowSignin: false,
        disableCredentialsLogin: false,
      });

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(403);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should reject registration when credentials login is disabled", async () => {
      mockSettingsFindFirst.mockResolvedValue({
        allowSignin: true,
        disableCredentialsLogin: true,
      });

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(403);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    it("should reject missing email and password", async () => {
      const req = makeRequest({});
      const response = await POST(req);

      expect(response.status).toBe(400);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should reject missing email", async () => {
      const req = makeRequest({ password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it("should reject missing password", async () => {
      const req = makeRequest({ email: "user@example.com" });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it("should reject an invalid email format", async () => {
      const req = makeRequest({ email: "not-an-email", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it("should reject a password that is too short (< 6 chars)", async () => {
      const req = makeRequest({ email: "user@example.com", password: "abc" });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it("should reject a password that is too long (> 100 chars)", async () => {
      const req = makeRequest({ email: "user@example.com", password: "a".repeat(101) });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });

  describe("duplicate user detection", () => {
    beforeEach(() => {
      mockUserCount.mockResolvedValue(1);
    });

    it("should reject registration for an already existing email", async () => {
      mockUserFindUnique.mockResolvedValue({ id: "existing-user", email: "user@example.com" });

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(400);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  describe("password hashing", () => {
    it("should hash the password before storing", async () => {
      const req = makeRequest({ email: "user@example.com", password: "plaintext" });
      await POST(req);

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: "hashed:plaintext" }),
        })
      );
    });

    it("should not store the plain-text password", async () => {
      const req = makeRequest({ email: "user@example.com", password: "plaintext" });
      await POST(req);

      const createCall = mockUserCreate.mock.calls[0][0];
      expect(createCall.data.password).not.toBe("plaintext");
    });
  });

  describe("error handling", () => {
    it("should return 500 on unexpected database error", async () => {
      mockUserCreate.mockRejectedValue(new Error("DB connection error"));

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });
});
