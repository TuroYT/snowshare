/**
 * @jest-environment node
 */

type MockPrisma = {
  settings: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock; update: jest.Mock };
  account: { create: jest.Mock; findFirst: jest.Mock };
  verificationToken: { findFirst: jest.Mock; delete: jest.Mock };
  oAuthProvider: { findMany: jest.Mock; findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  settings: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  account: { create: jest.fn(), findFirst: jest.fn() },
  verificationToken: { findFirst: jest.fn(), delete: jest.fn() },
  oAuthProvider: { findMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((fn: (tx: MockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("@/lib/providers", () => ({
  providerMap: {},
}));

const mockCookieStore = { get: jest.fn() };
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => mockCookieStore),
}));

import { prisma } from "@/lib/prisma";
import { getAuthOptions } from "@/lib/auth";

const mockUser = { email: "user@example.com", id: "u1", name: "Test" };
const mockAccount = {
  provider: "azure-ad",
  type: "oauth" as const,
  providerAccountId: "aad-123",
  refresh_token: undefined,
  access_token: "tok",
  expires_at: undefined,
  token_type: "Bearer",
  scope: "openid",
  id_token: undefined,
  session_state: undefined,
};

describe("signIn callback - SSO auto-link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
      allowSignin: true,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.account.create as jest.Mock).mockResolvedValue({});
    (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.oAuthProvider.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.oAuthProvider.findUnique as jest.Mock).mockResolvedValue({ tenantId: "common" });
  });

  it("auto-links account and resets flag when ssoAutoLink is true", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      ssoAutoLink: true,
      accounts: [],
    });

    const options = await getAuthOptions();
    const signIn = options.callbacks!.signIn!;
    const result = await signIn({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", provider: "azure-ad" }),
      })
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { ssoAutoLink: false },
    });
  });

  it("blocks ssoAutoLink user when allowSignin is false", async () => {
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
      allowSignin: false,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      ssoAutoLink: true,
      accounts: [],
    });

    const options = await getAuthOptions();
    const signIn = options.callbacks!.signIn!;
    const result = await signIn({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe("/auth/signin?error=OAuthSigninDisabled");
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("blocks SSO login when user exists, no ssoAutoLink, and no link token", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      ssoAutoLink: false,
      accounts: [],
    });
    (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null);

    const options = await getAuthOptions();
    const signIn = options.callbacks!.signIn!;
    const result = await signIn({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe("/auth/signin?error=OAuthAccountNotLinked");
  });

  it("allows SSO login when account already linked regardless of ssoAutoLink", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      ssoAutoLink: false,
      accounts: [{ provider: "azure-ad", providerAccountId: "aad-123" }],
    });

    const options = await getAuthOptions();
    const signIn = options.callbacks!.signIn!;
    const result = await signIn({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe(true);
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("handles race condition: P2002 unique constraint, account already linked — allows sign-in and resets flag", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        // Initial lookup: user has ssoAutoLink=true, no linked account yet
        id: "u1",
        email: "user@example.com",
        ssoAutoLink: true,
        accounts: [],
      })
      .mockResolvedValueOnce({
        // Re-check after P2002: flag still set (concurrent request hasn't reset it)
        ssoAutoLink: true,
      });
    // Concurrent request already created the account link
    (prisma.account.findFirst as jest.Mock).mockResolvedValue({
      provider: "azure-ad",
      providerAccountId: "aad-123",
    });

    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    (prisma.$transaction as jest.Mock).mockRejectedValue(p2002Error);

    const options = await getAuthOptions();
    const signIn = options.callbacks!.signIn!;
    const result = await signIn({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe(true);
    // Flag should be reset since concurrent request left it true
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { ssoAutoLink: false },
    });
  });

  it("handles race condition: P2002 unique constraint, account not linked — returns false", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      email: "user@example.com",
      ssoAutoLink: true,
      accounts: [],
    });
    // No matching linked account found after P2002
    (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);

    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    (prisma.$transaction as jest.Mock).mockRejectedValue(p2002Error);

    const options = await getAuthOptions();
    const signIn = options.callbacks!.signIn!;
    const result = await signIn({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe(false);
  });

  it("refuses to create a new SSO user when sign-up is disabled", async () => {
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ allowSignin: false });

    const options = await getAuthOptions();
    const result = await options.callbacks!.signIn!({
      user: mockUser,
      account: mockAccount,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe("/auth/signin?error=OAuthSigninDisabled");
  });

  describe("verified provider email", () => {
    const idToken = (claims: Record<string, unknown>) =>
      `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        ssoAutoLink: false,
        accounts: [],
      });
      (prisma.$transaction as jest.Mock).mockImplementation(
        (fn: (tx: MockPrisma) => Promise<unknown>) => fn(mockPrisma)
      );
      mockCookieStore.get.mockReturnValue(undefined);
    });

    async function runSignIn(
      account: typeof mockAccount | Record<string, unknown>,
      profile?: object
    ) {
      const options = await getAuthOptions();
      return options.callbacks!.signIn!({
        user: mockUser,
        account: account as typeof mockAccount,
        profile: profile as never,
        email: undefined,
        credentials: undefined,
      });
    }

    it("auto-links a Google account whose email is verified", async () => {
      const result = await runSignIn(
        { ...mockAccount, provider: "google", providerAccountId: "g-1" },
        { email: "user@example.com", email_verified: true }
      );

      expect(result).toBe(true);
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "u1", provider: "google" }),
        })
      );
    });

    it("does not auto-link a Google account whose email is not verified", async () => {
      const result = await runSignIn(
        { ...mockAccount, provider: "google", providerAccountId: "g-1" },
        { email: "user@example.com", email_verified: false }
      );

      expect(result).toBe("/auth/signin?error=OAuthAccountNotLinked");
      expect(prisma.account.create).not.toHaveBeenCalled();
    });

    it("auto-links an Entra ID account on a single-tenant configuration", async () => {
      (prisma.oAuthProvider.findUnique as jest.Mock).mockResolvedValue({
        tenantId: "11111111-2222-3333-4444-555555555555",
      });

      const result = await runSignIn({
        ...mockAccount,
        id_token: idToken({ email: "User@Example.com" }),
      });

      expect(result).toBe(true);
      expect(prisma.account.create).toHaveBeenCalled();
    });

    it("does not auto-link a multi-tenant Entra ID account without xms_edov", async () => {
      const result = await runSignIn({
        ...mockAccount,
        id_token: idToken({ email: "user@example.com" }),
      });

      expect(result).toBe("/auth/signin?error=OAuthAccountNotLinked");
      expect(prisma.account.create).not.toHaveBeenCalled();
    });

    it("auto-links a multi-tenant Entra ID account with xms_edov", async () => {
      const result = await runSignIn({
        ...mockAccount,
        id_token: idToken({ email: "user@example.com", xms_edov: true }),
      });

      expect(result).toBe(true);
    });
  });

  describe("explicit account link token", () => {
    const linkToken = { identifier: "account-link:user@example.com:azure-ad", token: "tok-1" };

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        ssoAutoLink: false,
        accounts: [],
      });
      // Earlier tests override the transaction mock; run callbacks against the mock client
      (prisma.$transaction as jest.Mock).mockImplementation(
        (fn: (tx: MockPrisma) => Promise<unknown>) => fn(mockPrisma)
      );
    });

    async function runSignIn() {
      const options = await getAuthOptions();
      return options.callbacks!.signIn!({
        user: mockUser,
        account: mockAccount,
        profile: undefined,
        email: undefined,
        credentials: undefined,
      });
    }

    it("refuses to link when the browser has no link cookie", async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(linkToken);

      expect(await runSignIn()).toBe("/auth/signin?error=OAuthAccountNotLinked");
      expect(prisma.account.create).not.toHaveBeenCalled();
    });

    it("looks the token up by the cookie value and links the account", async () => {
      mockCookieStore.get.mockReturnValue({ value: "tok-1" });
      (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(linkToken);

      expect(await runSignIn()).toBe(true);
      expect((prisma.verificationToken.findFirst as jest.Mock).mock.calls[0][0].where.token).toBe(
        "tok-1"
      );
      expect(prisma.account.create).toHaveBeenCalled();
      expect(prisma.verificationToken.delete).toHaveBeenCalled();
    });
  });
});
