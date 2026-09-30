/**
 * @jest-environment node
 */

/**
 * Tests for the user profile API route (GET/PATCH /api/user/profile)
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
    },
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/settings", () => ({
  getSettingsCached: jest.fn(),
}));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((password: string) => Promise.resolve(`hashed:${password}`)),
  verifyPassword: jest.fn(),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

jest.mock("@/lib/email", () => ({
  sendVerificationEmail: jest.fn(),
}));

import { GET, PATCH } from "@/app/api/user/profile/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getSettingsCached } from "@/lib/settings";
import { hashPassword, verifyPassword } from "@/lib/security";
import { sendVerificationEmail } from "@/lib/email";
import { NextRequest } from "next/server";

const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;
const mockTokenCreate = prisma.verificationToken.create as jest.Mock;
const mockGetSession = getServerSession as jest.Mock;
const mockGetSettings = getSettingsCached as jest.Mock;
const mockVerifyPassword = verifyPassword as jest.Mock;
const mockSendVerificationEmail = sendVerificationEmail as jest.Mock;

function makeRequest(body?: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: { get: jest.fn().mockReturnValue(null) },
  } as unknown as NextRequest;
}

const passwordUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  password: "stored-hash",
};

const updatedUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  image: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  defaultTab: "linkshare",
};

describe("/api/user/profile", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockFindUnique.mockResolvedValue(passwordUser);
    mockUpdate.mockResolvedValue(updatedUser);
    mockVerifyPassword.mockResolvedValue(true);
    (hashPassword as jest.Mock).mockImplementation((p: string) => Promise.resolve(`hashed:${p}`));
    mockGetSettings.mockResolvedValue({ emailVerificationRequired: false, smtpEnabled: false });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("returns 404 when the user does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      const res = await GET(makeRequest());
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("USER_NOT_FOUND");
    });

    it("returns the user profile", async () => {
      mockFindUnique.mockResolvedValue({ id: "user-1", name: "Alice", isAdmin: false });
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      expect((await res.json()).user).toEqual({ id: "user-1", name: "Alice", isAdmin: false });
    });

    it("returns 500 when the database fails", async () => {
      mockFindUnique.mockRejectedValue(new Error("db down"));
      const res = await GET(makeRequest());
      expect(res.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue({ user: {} });
      const res = await PATCH(makeRequest({ name: "Bob" }));
      expect(res.status).toBe(401);
    });

    it("returns 404 when the user does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      const res = await PATCH(makeRequest({ name: "Bob" }));
      expect(res.status).toBe(404);
    });

    it("returns 500 when the body cannot be parsed", async () => {
      const req = makeRequest();
      (req.json as jest.Mock).mockRejectedValue(new Error("bad json"));
      const res = await PATCH(req);
      expect(res.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    describe("name and default tab", () => {
      it("updates the name and default tab", async () => {
        const res = await PATCH(makeRequest({ name: "Bob", defaultTab: "pasteshare" }));
        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ data: { name: "Bob", defaultTab: "pasteshare" } })
        );
        const body = await res.json();
        expect(body.requiresVerification).toBeUndefined();
      });

      it("allows clearing the name with null", async () => {
        const res = await PATCH(makeRequest({ name: null }));
        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { name: null } }));
      });

      it("rejects a non-string name", async () => {
        const res = await PATCH(makeRequest({ name: 42 }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_REQUEST");
        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects a name that is too long", async () => {
        const res = await PATCH(makeRequest({ name: "a".repeat(101) }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("DISPLAY_NAME_TOO_LONG");
      });

      it("rejects an invalid default tab", async () => {
        const res = await PATCH(makeRequest({ defaultTab: "unknown" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_REQUEST");
      });
    });

    describe("email change", () => {
      it("requires the current password", async () => {
        const res = await PATCH(makeRequest({ email: "new@example.com" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("CURRENT_PASSWORD_REQUIRED");
      });

      it("rejects an incorrect current password", async () => {
        mockVerifyPassword.mockResolvedValue(false);
        const res = await PATCH(makeRequest({ email: "new@example.com", currentPassword: "bad" }));
        expect((await res.json()).code).toBe("INCORRECT_CURRENT_PASSWORD");
        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects an invalid email format", async () => {
        const res = await PATCH(makeRequest({ email: "not-an-email", currentPassword: "pw" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_EMAIL_FORMAT");
      });

      it("rejects a non-string email", async () => {
        const res = await PATCH(makeRequest({ email: 123, currentPassword: "pw" }));
        expect((await res.json()).code).toBe("INVALID_EMAIL_FORMAT");
      });

      it("rejects an email already in use", async () => {
        mockFindUnique
          .mockResolvedValueOnce(passwordUser)
          .mockResolvedValueOnce({ id: "other-user" });
        const res = await PATCH(makeRequest({ email: "taken@example.com", currentPassword: "pw" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("USER_ALREADY_EXISTS");
      });

      it("marks the new email as verified when verification is not required", async () => {
        mockFindUnique.mockResolvedValueOnce(passwordUser).mockResolvedValueOnce(null);
        const res = await PATCH(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
        expect(res.status).toBe(200);
        const data = mockUpdate.mock.calls[0][0].data;
        expect(data.email).toBe("new@example.com");
        expect(data.emailVerified).toBeInstanceOf(Date);
        expect(mockTokenCreate).not.toHaveBeenCalled();
        expect(mockSendVerificationEmail).not.toHaveBeenCalled();
      });

      it("treats missing settings as no verification required", async () => {
        mockGetSettings.mockResolvedValue(null);
        mockFindUnique.mockResolvedValueOnce(passwordUser).mockResolvedValueOnce(null);
        const res = await PATCH(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
        expect(res.status).toBe(200);
        expect(mockSendVerificationEmail).not.toHaveBeenCalled();
      });

      it("sends a verification email when required", async () => {
        mockGetSettings.mockResolvedValue({ emailVerificationRequired: true, smtpEnabled: true });
        mockFindUnique.mockResolvedValueOnce(passwordUser).mockResolvedValueOnce(null);
        const res = await PATCH(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
        expect(res.status).toBe(200);
        expect((await res.json()).requiresVerification).toBe(true);
        expect(mockUpdate.mock.calls[0][0].data.emailVerified).toBeNull();
        expect(mockTokenCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({ identifier: "email-verify:new@example.com" }),
        });
        expect(mockSendVerificationEmail).toHaveBeenCalledWith(
          "new@example.com",
          expect.any(String)
        );
      });

      it("still succeeds when sending the verification email fails", async () => {
        mockGetSettings.mockResolvedValue({ emailVerificationRequired: true, smtpEnabled: true });
        mockFindUnique.mockResolvedValueOnce(passwordUser).mockResolvedValueOnce(null);
        mockSendVerificationEmail.mockRejectedValue(new Error("smtp down"));
        const res = await PATCH(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
        expect(res.status).toBe(200);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("skips re-authentication for accounts without a password (OAuth)", async () => {
        mockFindUnique
          .mockResolvedValueOnce({ ...passwordUser, password: null })
          .mockResolvedValueOnce(null);
        const res = await PATCH(makeRequest({ email: "new@example.com" }));
        expect(res.status).toBe(200);
        expect(mockVerifyPassword).not.toHaveBeenCalled();
      });

      it("does not re-authenticate when the email is unchanged", async () => {
        const res = await PATCH(makeRequest({ email: "alice@example.com", name: "Alice B" }));
        expect(res.status).toBe(200);
        expect(mockVerifyPassword).not.toHaveBeenCalled();
        expect(mockUpdate.mock.calls[0][0].data.email).toBeUndefined();
      });
    });

    describe("password change", () => {
      it("requires the current password", async () => {
        const res = await PATCH(makeRequest({ newPassword: "newpassword123" }));
        expect((await res.json()).code).toBe("CURRENT_PASSWORD_REQUIRED");
      });

      it("hashes and stores a valid new password", async () => {
        const res = await PATCH(
          makeRequest({ newPassword: "newpassword123", currentPassword: "old" })
        );
        expect(res.status).toBe(200);
        expect(mockVerifyPassword).toHaveBeenCalledWith("old", "stored-hash");
        expect(mockUpdate.mock.calls[0][0].data.password).toBe("hashed:newpassword123");
      });

      it("rejects a new password with an invalid length", async () => {
        const res = await PATCH(makeRequest({ newPassword: "x", currentPassword: "old" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("PASSWORD_LENGTH");
      });

      it("rejects a non-string new password", async () => {
        const res = await PATCH(makeRequest({ newPassword: 12345678, currentPassword: "old" }));
        expect((await res.json()).code).toBe("PASSWORD_LENGTH");
      });

      it("forbids setting a password on an account without one", async () => {
        mockFindUnique.mockResolvedValue({ ...passwordUser, password: null });
        const res = await PATCH(makeRequest({ newPassword: "newpassword123" }));
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe("FORBIDDEN");
      });
    });

    it("returns 500 when the update fails", async () => {
      mockUpdate.mockRejectedValue(new Error("db down"));
      const res = await PATCH(makeRequest({ name: "Bob" }));
      expect(res.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
