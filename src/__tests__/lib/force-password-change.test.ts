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
import type { Account, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { authOptions, getAuthOptions } from "@/lib/auth";
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

describe("jwt callback: account state", () => {
  let jwt: JwtCallback;
  let sessionCb: (p: { session: Session; token: JWT }) => Promise<Session>;

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockPrisma.oAuthProvider.findMany.mockResolvedValue([]);
    jwt = await getJwt();
    sessionCb = (await getAuthOptions()).callbacks!.session as unknown as typeof sessionCb;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      mustChangePassword: false,
      sessionsValidFrom: null,
    });
  });

  const dbSays = (mustChangePassword: boolean, sessionsValidFrom: Date | null = null) =>
    mockPrisma.user.findUnique.mockResolvedValue({ mustChangePassword, sessionsValidFrom });

  it("flags a password sign-in of a user who must change it", async () => {
    dbSays(true);
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: flaggedUser,
      account: credentials,
    });
    expect(token.mustChangePassword).toBe(true);
    expect(token.viaPassword).toBe(true);
    expect(token.revoked).toBe(false);
  });

  it("does not flag a regular password sign-in", async () => {
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: { id: "u1" } as User,
      account: credentials,
    });
    expect(token.mustChangePassword).toBe(false);
  });

  it("never flags an SSO sign-in, even for a flagged user", async () => {
    dbSays(true);
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: flaggedUser,
      account: github,
    });
    expect(token.mustChangePassword).toBe(false);
    expect(token.viaPassword).toBe(false);
  });

  it("applies a flag set by an admin to a session that is already open", async () => {
    dbSays(true);
    const token = await jwt({
      token: { id: "u1", email: "a@b.co", viaPassword: true, signedInAt: Date.now() },
    });
    expect(token.mustChangePassword).toBe(true);
  });

  it("lets the user through once the database says the change was made", async () => {
    dbSays(false);
    const token = await jwt({
      token: {
        id: "u1",
        email: "a@b.co",
        viaPassword: true,
        mustChangePassword: true,
        signedInAt: 5,
      },
      trigger: "update",
    });
    expect(token.mustChangePassword).toBe(false);
  });

  it("revokes a session opened before the password was set by an admin or a reset", async () => {
    dbSays(false, new Date(10_000));
    const token = await jwt({ token: { id: "u1", email: "a@b.co", signedInAt: 9_999 } });
    expect(token.revoked).toBe(true);
  });

  it("keeps a session opened after the change (including the same millisecond)", async () => {
    dbSays(false, new Date(10_000));
    for (const signedInAt of [10_000, 10_001]) {
      const token = await jwt({ token: { id: "u1", email: "a@b.co", signedInAt } });
      expect(token.revoked).toBe(false);
    }
  });

  it("revokes a session that predates the signedInAt field once a change is recorded", async () => {
    dbSays(false, new Date(10_000));
    const token = await jwt({ token: { id: "u1", email: "a@b.co" } });
    expect(token.revoked).toBe(true);
  });

  it("revokes the session of a deleted user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const token = await jwt({ token: { id: "u1", email: "a@b.co", signedInAt: 1 } });
    expect(token.revoked).toBe(true);
  });

  it("never un-revokes a session, and does not query the database again for it", async () => {
    const token = await jwt({ token: { id: "u1", email: "a@b.co", revoked: true } });
    expect(token.revoked).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("fails closed when the database cannot be read: the error reaches the caller", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));
    await expect(
      jwt({ token: { id: "u1", email: "a@b.co", viaPassword: true, signedInAt: 1 } })
    ).rejects.toThrow("db down");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("uses the time the sign-in began, so a change committed meanwhile revokes the session", async () => {
    // Sign-in began at 5_000; the password was changed at 5_500, while it was in flight
    dbSays(false, new Date(5_500));
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: { id: "u1", authenticatedAt: 5_000 } as User,
      account: credentials,
    });
    expect(token.signedInAt).toBe(5_000);
    expect(token.revoked).toBe(true);
  });

  it("falls back to now for a sign-in that carries no start time (SSO)", async () => {
    const before = Date.now();
    const token = await jwt({
      token: { id: "", email: "a@b.co" },
      user: { id: "u1" } as User,
      account: github,
    });
    expect(token.signedInAt).toBeGreaterThanOrEqual(before);
  });

  it("empties the session of a revoked token: signed out for routes and for the client", async () => {
    const session = { user: { id: "", name: null }, expires: "2030-01-01" } as unknown as Session;
    const out = await sessionCb({ session, token: { id: "u1", revoked: true } });
    expect(out).toEqual({});
  });

  it("exposes the flag to the client session of a live token", async () => {
    const session = { user: { id: "", name: null }, expires: "x" } as unknown as Session;
    const out = await sessionCb({ session, token: { id: "u1", mustChangePassword: true } });
    expect(out.user.mustChangePassword).toBe(true);
    expect(out.user.id).toBe("u1");
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

  it("stamps the sign-in before the stored hash is read", async () => {
    mockPrisma.oAuthProvider.findMany.mockResolvedValue([]);
    const options = await getAuthOptions();
    const provider = options.providers.find((p) => p.id === "credentials") as unknown as {
      options: { authorize: Authorize };
    };
    let readAt = 0;
    mockPrisma.user.findUnique.mockImplementation(async () => {
      readAt = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        id: "u9",
        email: "stamp@change.co",
        name: null,
        password: await bcrypt.hash("pw-123456", 4),
        emailVerified: new Date(),
        totpEnabled: false,
        totpSecret: null,
        totpLastCounter: null,
        mustChangePassword: false,
      };
    });
    const user = (await provider.options.authorize(
      { email: "stamp@change.co", password: "pw-123456" },
      { headers: { "x-forwarded-for": "10.9.9.8" } }
    )) as { authenticatedAt: number };
    expect(user.authenticatedAt).toBeLessThanOrEqual(readAt);
    expect(user.authenticatedAt).toBeGreaterThan(0);
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

  it("lets the change page call what it needs (profile, sign-in plumbing, public settings)", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: true });
    for (const path of [
      "/api/user/profile",
      "/api/auth/session",
      "/api/setup/check",
      "/api/settings",
      "/api/health",
    ]) {
      const res = await visit(path);
      expect(res.status).toBe(200);
    }
  });

  it("answers 403 to every other API route while the change is pending", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: true });
    for (const path of ["/api/shares", "/api/upload", "/api/user/shares", "/api/admin/users"]) {
      const res = await visit(path);
      expect(res.status).toBe(403);
    }
  });

  it("does not block the API for a revoked session (the routes answer 401 themselves)", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: true, revoked: true });
    expect((await visit("/api/shares")).status).toBe(200);
  });

  it("does not block the API for everyone else", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", mustChangePassword: false });
    expect((await visit("/api/shares")).status).toBe(200);
    mockGetToken.mockResolvedValue(null);
    expect((await visit("/api/shares")).status).toBe(200);
  });

  it("treats a revoked session as signed out on protected pages", async () => {
    mockGetToken.mockResolvedValue({ id: "u1", revoked: true });
    const res = await visit("/admin");
    expect(res.headers.get("location")).toContain("/auth/signin");
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

describe("static options (getServerSession)", () => {
  it("copies the forced-change flag to the session like the dynamic options do", async () => {
    const session = { user: { id: "", name: null }, expires: "x" } as unknown as Session;
    const sessionCb = authOptions.callbacks!.session as unknown as (p: {
      session: Session;
      token: JWT;
    }) => Promise<Session>;
    const out = await sessionCb({ session, token: { id: "u1", mustChangePassword: true } });
    expect(out.user.mustChangePassword).toBe(true);
  });
});
