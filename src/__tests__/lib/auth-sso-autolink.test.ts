/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    settings: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    account: { create: jest.fn() },
    verificationToken: { findFirst: jest.fn(), delete: jest.fn() },
    oAuthProvider: { findMany: jest.fn() },
  },
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
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ allowSignin: true });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.account.create as jest.Mock).mockResolvedValue({});
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.oAuthProvider as any).findMany.mockResolvedValue([]);
  });

  it("auto-links account and resets flag when ssoAutoLink is true", async () => {
    const callOrder: string[] = [];
    (prisma.account.create as jest.Mock).mockImplementation(() => {
      callOrder.push("account.create");
      return Promise.resolve({});
    });
    (prisma.user.update as jest.Mock).mockImplementation(() => {
      callOrder.push("user.update");
      return Promise.resolve({});
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

    expect(result).toBe(true);
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", provider: "azure-ad" }),
      })
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { ssoAutoLink: false },
    });
    expect(callOrder).toEqual(["account.create", "user.update"]);
  });

  it("blocks ssoAutoLink user when allowSignin is false", async () => {
    (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ allowSignin: false });
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
});
