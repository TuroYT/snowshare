/**
 * @jest-environment node
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((p: string) => Promise.resolve(`hashed:${p}`)),
}));
jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { GET, PATCH, POST } from "@/app/api/admin/users/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const mockSession = getServerSession as jest.Mock;
const user = prisma.user as unknown as Record<string, jest.Mock>;

function req(method: string, body?: object, query = "") {
  return new NextRequest(`http://localhost/api/admin/users${query}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function badJsonReq(method: string) {
  return new NextRequest("http://localhost/api/admin/users", {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{bad",
  });
}

describe("admin users route (extra branches)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockSession.mockResolvedValue({ user: { id: "admin" } });
    user.findUnique.mockResolvedValue({ id: "admin", isAdmin: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each([
    ["GET", () => GET(req("GET"))],
    ["PATCH", () => PATCH(req("PATCH", { userId: "u", action: "promote" }))],
    ["POST", () => POST(req("POST", { email: "a@b.co", password: "password123" }))],
  ])("%s authorization", (_name, call) => {
    it("returns 401 without a session", async () => {
      mockSession.mockResolvedValue(null);
      expect((await call()).status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      user.findUnique.mockResolvedValue({ id: "admin", isAdmin: false });
      expect((await call()).status).toBe(403);
    });

    it("returns 403 when the user no longer exists", async () => {
      user.findUnique.mockResolvedValue(null);
      expect((await call()).status).toBe(403);
    });
  });

  describe("GET", () => {
    it("lists users without pagination", async () => {
      user.findMany.mockResolvedValue([{ id: "u1" }]);
      const res = await GET(req("GET"));
      expect(res.status).toBe(200);
      expect((await res.json()).users).toEqual([{ id: "u1" }]);
      const args = user.findMany.mock.calls[0][0];
      expect(args).not.toHaveProperty("take");
      expect(args).not.toHaveProperty("skip");
    });

    it("applies limit and offset", async () => {
      user.findMany.mockResolvedValue([]);
      await GET(req("GET", undefined, "?limit=10&offset=5"));
      expect(user.findMany.mock.calls[0][0]).toMatchObject({ take: 10, skip: 5 });
    });

    it("clamps the limit between 1 and 100", async () => {
      user.findMany.mockResolvedValue([]);
      await GET(req("GET", undefined, "?limit=1000"));
      expect(user.findMany.mock.calls[0][0].take).toBe(100);
      await GET(req("GET", undefined, "?limit=0"));
      expect(user.findMany.mock.calls[1][0].take).toBe(1);
    });

    it("ignores invalid or negative pagination values", async () => {
      user.findMany.mockResolvedValue([]);
      await GET(req("GET", undefined, "?limit=abc&offset=-3"));
      const args = user.findMany.mock.calls[0][0];
      expect(args).not.toHaveProperty("take");
      expect(args).not.toHaveProperty("skip");
      await GET(req("GET", undefined, "?offset=xyz"));
      expect(user.findMany.mock.calls[1][0]).not.toHaveProperty("skip");
    });

    it("returns 500 when the query fails", async () => {
      user.findMany.mockRejectedValue(new Error("db"));
      expect((await GET(req("GET"))).status).toBe(500);
    });
  });

  describe("PATCH", () => {
    it("returns 400 when data is missing", async () => {
      expect((await PATCH(req("PATCH", { userId: "u" }))).status).toBe(400);
      expect((await PATCH(req("PATCH", { action: "promote" }))).status).toBe(400);
    });

    it.each([
      ["enableSsoAutoLink", true],
      ["disableSsoAutoLink", false],
    ])("handles %s (allowed on self)", async (action, value) => {
      user.update.mockResolvedValue({});
      const res = await PATCH(req("PATCH", { userId: "admin", action }));
      expect(res.status).toBe(200);
      expect(user.update).toHaveBeenCalledWith({
        where: { id: "admin" },
        data: { ssoAutoLink: value },
      });
    });

    it("forbids modifying oneself", async () => {
      const res = await PATCH(req("PATCH", { userId: "admin", action: "delete" }));
      expect(res.status).toBe(403);
      expect(user.delete).not.toHaveBeenCalled();
    });

    it("promotes a user", async () => {
      user.update.mockResolvedValue({});
      const res = await PATCH(req("PATCH", { userId: "u1", action: "promote" }));
      expect(res.status).toBe(200);
      expect(user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { isAdmin: true } });
    });

    it("demotes a user", async () => {
      user.update.mockResolvedValue({});
      const res = await PATCH(req("PATCH", { userId: "u1", action: "demote" }));
      expect(res.status).toBe(200);
      expect(user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { isAdmin: false } });
    });

    it("deletes a user", async () => {
      user.delete.mockResolvedValue({});
      const res = await PATCH(req("PATCH", { userId: "u1", action: "delete" }));
      expect(res.status).toBe(200);
      expect(user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    });

    it("rejects unknown actions", async () => {
      expect((await PATCH(req("PATCH", { userId: "u1", action: "zap" }))).status).toBe(400);
    });

    it("returns 500 on invalid JSON", async () => {
      expect((await PATCH(badJsonReq("PATCH"))).status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    it("rejects a missing or non-string email", async () => {
      expect((await POST(req("POST", { password: "password123" }))).status).toBe(400);
      expect((await POST(req("POST", { email: 5, password: "password123" }))).status).toBe(400);
    });

    it("rejects an invalid email format", async () => {
      expect((await POST(req("POST", { email: "nope", password: "password123" }))).status).toBe(
        400
      );
    });

    it("rejects a non-boolean ssoAutoLink", async () => {
      const res = await POST(
        req("POST", { email: "a@b.co", password: "password123", ssoAutoLink: "true" })
      );
      expect(res.status).toBe(400);
    });

    it("requires a password unless ssoAutoLink is true", async () => {
      expect((await POST(req("POST", { email: "a@b.co" }))).status).toBe(400);
    });

    it("rejects a password of invalid length", async () => {
      expect((await POST(req("POST", { email: "a@b.co", password: "short" }))).status).toBe(400);
    });

    it("rejects an existing email", async () => {
      user.findUnique.mockResolvedValue({ id: "other", isAdmin: true });
      const res = await POST(req("POST", { email: "a@b.co", password: "password123" }));
      expect(res.status).toBe(400);
    });

    it("creates an SSO-only user without a password", async () => {
      user.findUnique.mockImplementation(({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id ? { id: "admin", isAdmin: true } : null)
      );
      user.create.mockResolvedValue({ id: "n1" });
      const res = await POST(
        req("POST", { email: "a@b.co", ssoAutoLink: true, name: "N", isAdmin: true })
      );
      expect(res.status).toBe(201);
      expect(user.create.mock.calls[0][0].data).toMatchObject({
        email: "a@b.co",
        name: "N",
        password: undefined,
        isAdmin: true,
        ssoAutoLink: true,
      });
    });

    it("returns 500 when creation fails", async () => {
      user.findUnique.mockImplementation(({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id ? { id: "admin", isAdmin: true } : null)
      );
      user.create.mockRejectedValue(new Error("db"));
      const res = await POST(req("POST", { email: "a@b.co", password: "password123" }));
      expect(res.status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
