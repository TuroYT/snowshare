/**
 * @jest-environment node
 */

const mockPrisma = {
  settings: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  account: { create: jest.fn(), findFirst: jest.fn() },
  verificationToken: { findFirst: jest.fn(), delete: jest.fn() },
  oAuthProvider: { findMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
    fn(mockPrisma)
  ),
};

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

jest.mock("@/lib/providers", () => ({
  providerMap: {},
}));

import { prisma } from "@/lib/prisma";
import { getAuthOptions } from "@/lib/auth";

const mockUser = { email: "user@example.com", id: "u1", name: "Test" };
const mockAccount = {
  provider: "azure-ad",
  type: "oauth",
  providerAccountId: "aad-123",
  refresh_token: null,
  access_token: "tok",
  expires_at: null,
  token_type: "Bearer",
  scope: "openid",
  id_token: null,
  session_state: null,
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

    expect(result).toBe(false);
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

    expect(result).toBe(false);
  });

  it("allows SSO login when account already linked regardless of ssoAutoLink", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      ssoAutoLink: false,
      accounts: [{ provider: "azure-ad" }],
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
});
