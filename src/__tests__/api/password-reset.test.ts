/**
 * @jest-environment node
 */

/**
 * Tests for the e-mail password reset flow
 * (POST /api/auth/forgot-password, GET and POST /api/auth/reset-password)
 */

jest.mock("@/lib/prisma", () => {
  const prisma: Record<string, unknown> = {
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
    verificationToken: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as [])
  );
  return { prisma };
});

jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn() }));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((password: string) => Promise.resolve(`hashed:${password}`)),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

jest.mock("@/lib/email", () => ({ sendResetLinkEmail: jest.fn() }));

import { NextRequest } from "next/server";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { GET as checkToken, POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
import { sendResetLinkEmail } from "@/lib/email";
import { hashPassword } from "@/lib/security";
import { hashResetToken } from "@/lib/password-reset";
import { __resetAllRateLimits } from "@/lib/rate-limit";

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdateMany = prisma.user.updateMany as jest.Mock;
const mockTokenFind = prisma.verificationToken.findUnique as jest.Mock;
const mockTokenDeleteMany = prisma.verificationToken.deleteMany as jest.Mock;
const mockTokenCreate = prisma.verificationToken.create as jest.Mock;
const mockSettings = getSettingsCached as jest.Mock;
const mockSend = sendResetLinkEmail as jest.Mock;

const RAW_TOKEN = "a".repeat(64);
const smtpOn = { smtpEnabled: true, smtpHost: "smtp.example.com", disableCredentialsLogin: false };

function post(path: string, body: unknown, ip = "10.0.0.1") {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const forgot = (body: unknown, ip?: string) => post("/api/auth/forgot-password", body, ip);
const reset = (body: unknown, ip?: string) => post("/api/auth/reset-password", body, ip);

/** The mail is sent after the response: let the detached promise chain settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  __resetAllRateLimits();
  mockSettings.mockResolvedValue(smtpOn);
  mockTokenDeleteMany.mockResolvedValue({ count: 1 });
  mockTokenCreate.mockResolvedValue({});
  mockSend.mockResolvedValue(true);
});

describe("POST /api/auth/forgot-password", () => {
  it("mails a reset link to an account with a password, storing only the token hash", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u1", email: "a@b.co", password: "hash" });
    const res = await forgotPassword(forgot({ email: "a@b.co" }));
    await flush();

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const [to, rawToken] = mockSend.mock.calls[0];
    expect(to).toBe("a@b.co");
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    const stored = mockTokenCreate.mock.calls[0][0].data;
    expect(stored.identifier).toBe("password-reset:u1");
    expect(stored.token).toBe(hashResetToken(rawToken));
    expect(stored.token).not.toBe(rawToken);
    // About one hour from now
    const ttl = stored.expires.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(59 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);
    // Earlier unexpired links stay valid (nobody can cancel the owner's link); only dead ones go
    expect(mockTokenDeleteMany).toHaveBeenCalledWith({
      where: { identifier: "password-reset:u1", expires: { lt: expect.any(Date) } },
    });
  });

  it("answers the same 200 for an unknown address and sends nothing", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "u1", email: "a@b.co", password: "hash" });
    const known = await forgotPassword(forgot({ email: "a@b.co" }, "10.0.0.2"));
    mockUserFindUnique.mockResolvedValue(null);
    const unknown = await forgotPassword(forgot({ email: "nobody@b.co" }, "10.0.0.3"));
    await flush();

    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a passwordless (SSO-only) account", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u2", email: "sso@b.co", password: null });
    const res = await forgotPassword(forgot({ email: "sso@b.co" }));
    await flush();

    expect(res.status).toBe(200);
    expect(mockTokenCreate).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("answers 200 even when the mail cannot be sent, and logs the failure", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUserFindUnique.mockResolvedValue({ id: "u1", email: "a@b.co", password: "hash" });
    mockSend.mockRejectedValue(new Error("smtp down"));
    const res = await forgotPassword(forgot({ email: "a@b.co" }));
    await flush();

    expect(res.status).toBe(200);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to send password reset email:",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it("mails an address at most once a minute and stays silent (200) for the rest", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u1", email: "a@b.co", password: "hash" });
    const first = await forgotPassword(forgot({ email: "a@b.co" }, "10.0.1.1"));
    const second = await forgotPassword(forgot({ email: "a@b.co" }, "10.0.1.2"));
    await flush();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("counts the address case-insensitively against that limit", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u1", email: "a@b.co", password: "hash" });
    await forgotPassword(forgot({ email: "a@b.co" }, "10.0.2.1"));
    await forgotPassword(forgot({ email: "A@B.co" }, "10.0.2.2"));
    await flush();
    // The second request is dropped before any lookup, whatever the case it was typed in
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
  });

  it("does not cancel the link already sent when someone requests another one", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u1", email: "a@b.co", password: "hash" });
    await forgotPassword(forgot({ email: "a@b.co" }, "10.0.2.3"));
    await flush();
    for (const call of mockTokenDeleteMany.mock.calls) {
      expect(call[0].where.expires).toEqual({ lt: expect.any(Date) });
    }
  });

  it("answers 429 once an IP made 10 requests in the hour", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) {
      const res = await forgotPassword(forgot({ email: `user${i}@b.co` }, "10.0.3.1"));
      expect(res.status).toBe(200);
    }
    const res = await forgotPassword(forgot({ email: "user11@b.co" }, "10.0.3.1"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it.each([
    ["missing email", {}, "EMAIL_REQUIRED"],
    ["blank email", { email: "   " }, "EMAIL_REQUIRED"],
    ["non-string email", { email: 42 }, "EMAIL_REQUIRED"],
    ["malformed email", { email: "not-an-email" }, "INVALID_EMAIL_FORMAT"],
  ])("rejects %s", async (_name, body, code) => {
    const res = await forgotPassword(forgot(body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const res = await forgotPassword(forgot("{nope"));
    expect(res.status).toBe(400);
  });

  it("answers 503 when SMTP is off, without looking up users", async () => {
    mockSettings.mockResolvedValue({ ...smtpOn, smtpEnabled: false });
    const res = await forgotPassword(forgot({ email: "a@b.co" }));
    expect(res.status).toBe(503);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("answers 503 on SSO-only instances (password sign-in disabled)", async () => {
    mockSettings.mockResolvedValue({ ...smtpOn, disableCredentialsLogin: true });
    const res = await forgotPassword(forgot({ email: "a@b.co" }));
    expect(res.status).toBe(503);
  });
});

describe("GET /api/auth/reset-password", () => {
  const check = (token?: string) =>
    new NextRequest(`http://localhost/api/auth/reset-password${token ? `?token=${token}` : ""}`, {
      headers: { "x-forwarded-for": "10.0.4.1" },
    });

  it("reports a live token without consuming it", async () => {
    mockTokenFind.mockResolvedValue({
      identifier: "password-reset:u1",
      expires: new Date(Date.now() + 60_000),
    });
    const res = await checkToken(check(RAW_TOKEN));

    expect(res.status).toBe(200);
    expect(mockTokenFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: hashResetToken(RAW_TOKEN) } })
    );
    expect(mockTokenDeleteMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    mockTokenFind.mockResolvedValue({
      identifier: "password-reset:u1",
      expires: new Date(Date.now() - 1),
    });
    expect((await checkToken(check(RAW_TOKEN))).status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    mockTokenFind.mockResolvedValue(null);
    expect((await checkToken(check(RAW_TOKEN))).status).toBe(400);
  });

  it("rejects a token that belongs to another flow (e-mail verification)", async () => {
    mockTokenFind.mockResolvedValue({
      identifier: "email-verify:a@b.co",
      expires: new Date(Date.now() + 60_000),
    });
    expect((await checkToken(check(RAW_TOKEN))).status).toBe(400);
  });

  it("requires a token", async () => {
    const res = await checkToken(check());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TOKEN_REQUIRED");
  });
});

describe("POST /api/auth/reset-password", () => {
  const liveToken = {
    identifier: "password-reset:u1",
    token: hashResetToken(RAW_TOKEN),
    expires: new Date(Date.now() + 60_000),
  };

  beforeEach(() => {
    mockTokenFind.mockResolvedValue(liveToken);
    mockUserUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("sets the password, clears the forced change, verifies the e-mail and burns the links", async () => {
    const res = await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }));

    expect(res.status).toBe(200);
    expect(mockUserUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "u1", password: { not: null } },
      data: {
        password: "hashed:newpass1",
        mustChangePassword: false,
        sessionsValidFrom: expect.any(Date),
      },
    });
    expect(mockUserUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "u1", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
    // The claim is atomic (token + not expired) and the user's other links go too
    expect(mockTokenDeleteMany).toHaveBeenNthCalledWith(1, {
      where: { token: hashResetToken(RAW_TOKEN), expires: { gt: expect.any(Date) } },
    });
    expect(mockTokenDeleteMany).toHaveBeenNthCalledWith(2, {
      where: { identifier: "password-reset:u1" },
    });
  });

  it("does not run bcrypt for a link that is unknown or expired", async () => {
    mockTokenFind.mockResolvedValue(null);
    await resetPassword(reset({ token: "x", password: "newpass1" }));
    mockTokenFind.mockResolvedValue({ ...liveToken, expires: new Date(Date.now() - 1) });
    await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }, "10.0.9.9"));
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("refuses a second submit of the same link (lost the claim race)", async () => {
    mockTokenDeleteMany.mockResolvedValueOnce({ count: 0 });
    const res = await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TOKEN_INVALID_OR_EXPIRED");
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses an expired token without touching the user", async () => {
    mockTokenFind.mockResolvedValue({ ...liveToken, expires: new Date(Date.now() - 1) });
    const res = await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }));

    expect(res.status).toBe(400);
    expect(mockTokenDeleteMany).not.toHaveBeenCalled();
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses a token minted for another flow", async () => {
    mockTokenFind.mockResolvedValue({ ...liveToken, identifier: "account-link:a@b.co:github" });
    const res = await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }));

    expect(res.status).toBe(400);
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses when the account has no password any more", async () => {
    mockUserUpdateMany.mockResolvedValueOnce({ count: 0 });
    const res = await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }));
    expect(res.status).toBe(400);
  });

  it("rejects a too short and a too long password before touching the token", async () => {
    for (const password of ["12345", "x".repeat(101), 123456, undefined]) {
      const res = await resetPassword(reset({ token: RAW_TOKEN, password }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("PASSWORD_LENGTH");
    }
    expect(mockTokenFind).not.toHaveBeenCalled();
  });

  it("accepts the password length limits (6 and 100 characters)", async () => {
    for (const password of ["123456", "x".repeat(100)]) {
      __resetAllRateLimits();
      const res = await resetPassword(reset({ token: RAW_TOKEN, password }));
      expect(res.status).toBe(200);
    }
  });

  it("requires a token", async () => {
    const res = await resetPassword(reset({ password: "newpass1" }));
    expect((await res.json()).code).toBe("TOKEN_REQUIRED");
  });

  it("is unavailable when SMTP is off", async () => {
    mockSettings.mockResolvedValue({ ...smtpOn, smtpEnabled: false });
    const res = await resetPassword(reset({ token: RAW_TOKEN, password: "newpass1" }));
    expect(res.status).toBe(400);
    expect(mockTokenFind).not.toHaveBeenCalled();
  });

  it("answers 429 after 10 attempts from one IP in the hour", async () => {
    mockTokenFind.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) {
      expect(
        (await resetPassword(reset({ token: "x", password: "newpass1" }, "10.0.5.1"))).status
      ).toBe(400);
    }
    const res = await resetPassword(reset({ token: "x", password: "newpass1" }, "10.0.5.1"));
    expect(res.status).toBe(429);
  });
});

describe("hashResetToken", () => {
  const original = process.env.NEXTAUTH_SECRET;
  afterEach(() => {
    process.env.NEXTAUTH_SECRET = original;
  });

  it("is a keyed hash: another secret gives another value, never the raw token", () => {
    const first = hashResetToken(RAW_TOKEN);
    process.env.NEXTAUTH_SECRET = "another-secret";
    expect(hashResetToken(RAW_TOKEN)).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain(RAW_TOKEN);
  });

  it("refuses to hash without NEXTAUTH_SECRET", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(() => hashResetToken(RAW_TOKEN)).toThrow("NEXTAUTH_SECRET");
  });
});
