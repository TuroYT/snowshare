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
    verificationToken: {
      create: jest.fn(),
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

jest.mock("@/lib/captcha", () => ({
  verifyCaptcha: jest.fn(),
}));

jest.mock("@/lib/email", () => ({
  sendVerificationEmail: jest.fn(),
}));

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest.fn(() => ({ toString: () => "test-token-hex" })),
}));

import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { verifyCaptcha } from "@/lib/captcha";
import { sendVerificationEmail } from "@/lib/email";
import { NextRequest } from "next/server";

const mockUserCount = prisma.user.count as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockSettingsFindFirst = prisma.settings.findFirst as jest.Mock;
const mockVerificationTokenCreate = prisma.verificationToken.create as jest.Mock;
const mockVerifyCaptcha = verifyCaptcha as jest.Mock;
const mockSendVerificationEmail = sendVerificationEmail as jest.Mock;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue(null),
    },
  } as unknown as NextRequest;
}

const baseSettings = {
  allowSignin: true,
  disableCredentialsLogin: false,
  captchaEnabled: false,
  captchaProvider: null,
  captchaSecretKey: null,
  emailVerificationRequired: false,
  smtpEnabled: false,
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserCount.mockResolvedValue(0);
    mockSettingsFindFirst.mockResolvedValue(baseSettings);
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isAdmin: true,
    });
    mockVerificationTokenCreate.mockResolvedValue({});
    mockSendVerificationEmail.mockResolvedValue(true);
  });

  // ─── Existing registration tests ───────────────────────────────────────────

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
      mockUserCount.mockResolvedValue(1);
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
        ...baseSettings,
        allowSignin: false,
      });

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(403);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should reject registration when credentials login is disabled", async () => {
      mockSettingsFindFirst.mockResolvedValue({
        ...baseSettings,
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

  // ─── CAPTCHA tests ──────────────────────────────────────────────────────────

  describe("CAPTCHA verification", () => {
    beforeEach(() => {
      mockUserCount.mockResolvedValue(1);
      mockSettingsFindFirst.mockResolvedValue({
        ...baseSettings,
        captchaEnabled: true,
        captchaProvider: "turnstile",
        captchaSecretKey: "secret-key",
      });
    });

    it("should reject registration when CAPTCHA token is missing", async () => {
      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(400);
      expect(mockVerifyCaptcha).not.toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should reject registration when CAPTCHA verification fails", async () => {
      mockVerifyCaptcha.mockResolvedValue(false);

      const req = makeRequest({
        email: "user@example.com",
        password: "password123",
        captchaToken: "invalid-token",
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      expect(mockVerifyCaptcha).toHaveBeenCalledWith(
        "invalid-token",
        "secret-key",
        "turnstile"
      );
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should allow registration when CAPTCHA verification succeeds", async () => {
      mockVerifyCaptcha.mockResolvedValue(true);
      mockUserCreate.mockResolvedValue({ id: "user-2", email: "user@example.com", isAdmin: false });

      const req = makeRequest({
        email: "user@example.com",
        password: "password123",
        captchaToken: "valid-token",
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockVerifyCaptcha).toHaveBeenCalledWith("valid-token", "secret-key", "turnstile");
      expect(mockUserCreate).toHaveBeenCalled();
    });

    it("should skip CAPTCHA verification for the first user", async () => {
      mockUserCount.mockResolvedValue(0);
      mockVerifyCaptcha.mockResolvedValue(false); // Would fail if called

      const req = makeRequest({ email: "admin@example.com", password: "password123" });
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockVerifyCaptcha).not.toHaveBeenCalled();
    });

    it("should pass the correct provider to verifyCaptcha", async () => {
      mockSettingsFindFirst.mockResolvedValue({
        ...baseSettings,
        captchaEnabled: true,
        captchaProvider: "recaptcha",
        captchaSecretKey: "recaptcha-secret",
      });
      mockVerifyCaptcha.mockResolvedValue(true);
      mockUserCreate.mockResolvedValue({ id: "user-2", email: "user@example.com", isAdmin: false });

      const req = makeRequest({
        email: "user@example.com",
        password: "password123",
        captchaToken: "recaptcha-token",
      });
      await POST(req);

      expect(mockVerifyCaptcha).toHaveBeenCalledWith(
        "recaptcha-token",
        "recaptcha-secret",
        "recaptcha"
      );
    });
  });

  // ─── Email verification tests ───────────────────────────────────────────────

  describe("email verification", () => {
    beforeEach(() => {
      mockUserCount.mockResolvedValue(1);
      mockSettingsFindFirst.mockResolvedValue({
        ...baseSettings,
        emailVerificationRequired: true,
        smtpEnabled: true,
      });
      mockUserCreate.mockResolvedValue({ id: "user-2", email: "user@example.com", isAdmin: false });
    });

    it("should create an unverified user and send a verification email", async () => {
      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresVerification).toBe(true);
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: null }),
        })
      );
      expect(mockVerificationTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identifier: "email-verify:user@example.com",
          }),
        })
      );
      expect(mockSendVerificationEmail).toHaveBeenCalledWith("user@example.com", "test-token-hex");
    });

    it("should return requiresVerification: false when SMTP is disabled", async () => {
      mockSettingsFindFirst.mockResolvedValue({
        ...baseSettings,
        emailVerificationRequired: true,
        smtpEnabled: false, // SMTP off → no email verification
      });
      mockUserCreate.mockResolvedValue({ id: "user-2", email: "user@example.com", isAdmin: false });

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresVerification).toBe(false);
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    });

    it("should mark the user as verified immediately when email verification is off", async () => {
      mockSettingsFindFirst.mockResolvedValue(baseSettings); // emailVerificationRequired: false

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresVerification).toBe(false);
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: expect.any(Date) }),
        })
      );
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    });

    it("should skip email verification for the first user even when enabled", async () => {
      mockUserCount.mockResolvedValue(0);

      const req = makeRequest({ email: "admin@example.com", password: "password123" });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresVerification).toBe(false);
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
      // First user is always marked as verified
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: expect.any(Date) }),
        })
      );
    });

    it("should succeed even if sending the verification email throws", async () => {
      mockSendVerificationEmail.mockRejectedValue(new Error("SMTP connection refused"));

      const req = makeRequest({ email: "user@example.com", password: "password123" });
      const response = await POST(req);
      const data = await response.json();

      // Registration should succeed; email failure is non-fatal
      expect(response.status).toBe(200);
      expect(data.requiresVerification).toBe(true);
    });
  });
});
