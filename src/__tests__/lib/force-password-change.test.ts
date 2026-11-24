/**
 * @jest-environment node
 */

/**
 * The admin-enforced password change: the JWT flag (src/lib/auth.ts) and the redirect (src/proxy.ts).
 */

const mockPrisma = {
  settings: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  oAuthProvider: { findMany: jest.fn() },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/providers", () => ({ providerMap: {} }));
jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: jest.fn() })) }));
jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn(async () => ({})) }));

const mockGetToken = jest.fn();
jest.mock("next-auth/jwt", () => ({ getToken: (...args: unknown[]) => mockGetToken(...args) }));

import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import type { Account, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { getAuthOptions } from "@/lib/auth";
import proxy from "@/proxy";

type JwtCallback = (params: {
  token: JWT;
  user?: User;
  account?: Account | null;
  trigger?: "signIn" | "signUp" | "update";
}) => Promise<JWT>;
type Authorize = (c: Record<string, string>, req: unknown) => Promise<unknown>;

async function getJwt(): Promise<JwtCallback> {
  const options = await getAuthOptions();
  return options.callbacks!.jwt as unknown as JwtCallback;
}

const credentials = { provider: "credentials" } as Account;
const github = { provider: "github" } as Account;
const flaggedUser = { id: "u1", name: "A", mustChangePassword: true } as User;

describe("jwt callback: mustChangePassword", () => {
  let jwt: JwtCallback;

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockPrisma.oAuthProvider.findMany.mockResolvedValue([]);
    jwt = await getJwt();
  });

  beforeEach(() => jest.clearAllMocks());

  it("flags a password sign-in of a user who must change it", async () => {
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: flaggedUser,
      account: credentials,
    });
    expect(token.mustChangePassword).toBe(true);
  });

  it("does not flag a regular password sign-in", async () => {
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: { id: "u1", mustChangePassword: false } as User,
      account: credentials,
    });
    expect(token.mustChangePassword).toBe(false);
  });

  it("never flags an SSO sign-in, even for a flagged user", async () => {
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: flaggedUser,
      account: github,
    });
    expect(token.mustChangePassword).toBe(false);
  });

  it("re-reads the flag from the database on a session update and lets the user through", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ mustChangePassword: false });
    const token = await jwt({
      token: { id: "u1", mustChangePassword: true },
      trigger: "update",
    });
    expect(token.mustChangePassword).toBe(false);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { mustChangePassword: true },
    });
  });

  it("keeps the flag while the database still says the change is pending", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ mustChangePassword: true });
    const token = await jwt({ token: { id: "u1", mustChangePassword: true }, trigger: "update" });
    expect(token.mustChangePassword).toBe(true);
  });

  it("keeps the flag when the database cannot be read", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));
    const token = await jwt({ token: { id: "u1", mustChangePassword: true }, trigger: "update" });
    expect(token.mustChangePassword).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not hit the database on an update when nothing is pending", async () => {
    await jwt({ token: { id: "u1" }, trigger: "update" });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("credentials authorize: mustChangePassword", () => {
  it("passes the flag of the user to the sign-in", async () => {
    mockPrisma.oAuthProvider.findMany.mockResolvedValue([]);
    const options = await getAuthOptions();
    const provider = options.providers.find((p) => p.id === "credentials") as unknown as {
      options: { authorize: Authorize };
    };
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u9",
      email: "must@change.co",
      name: null,
      password: await bcrypt.hash("temp-pass", 4),
      emailVerified: new Date(),
      totpEnabled: false,
      totpSecret: null,
      totpLastCounter: null,
      mustChangePassword: true,
    });
    const user = await provider.options.authorize(
      { email: "must@change.co", password: "temp-pass" },
      { headers: { "x-forwarded-for": "10.9.9.9" } }
    );
    expect(user).toMatchObject({ id: "u9", mustChangePassword: true });
  });
});

describe("proxy: forced password change redirect", () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    // The setup check goes through a loopback fetch
    global.fetch = jest.fn(async () =>
      Response.json({ needsSetup: false, allowIframeEmbedding: false })
    ) as typeof fetch;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => mockGetToken.mockReset());

  const visit = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));

  it("sends a flagged user from any page to the change-password page", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: true });
    for (const path of ["/", "/profile", "/admin", "/f/some-share"]) {
      const res = await visit(path);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/auth/change-password");
    }
  });

  it("lets the flagged user reach the auth pages (no redirect loop)", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: true });
    for (const path of ["/auth/change-password", "/auth/signin"]) {
      const res = await visit(path);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("does not touch API calls (the page needs them to save the new password)", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: true });
    const res = await visit("/api/user/profile");
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves everyone else alone", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: false });
    expect((await visit("/")).headers.get("location")).toBeNull();
    mockGetToken.mockResolvedValue(null);
    expect((await visit("/")).headers.get("location")).toBeNull();
  });

  it("still sends anonymous visitors of protected pages to the sign-in", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await visit("/admin");
    expect(res.headers.get("location")).toContain("/auth/signin?callbackUrl=%2Fadmin");
  });
});
