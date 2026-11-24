/**
 * @jest-environment node
 */

/**
 * Tests for the admin "set password" action and the force-change flag
 * (PATCH and POST /api/admin/users)
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    verificationToken: { deleteMany: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((p: string) => Promise.resolve(`hashed:${p}`)),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { PATCH, POST } from "@/app/api/admin/users/route";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;
const mockTokenDeleteMany = prisma.verificationToken.deleteMany as jest.Mock;

function request(method: "PATCH" | "POST", body: object) {
  return new NextRequest("http://localhost/api/admin/users", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const setPassword = (extra: object = {}) =>
  PATCH(
    request("PATCH", { userId: "target", action: "setPassword", password: "newpass1", ...extra })
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: "admin" } });
  mockFindUnique.mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
    if (where.id === "admin") return Promise.resolve({ id: "admin", isAdmin: true });
    if (where.id === "target") return Promise.resolve({ id: "target" });
    return Promise.resolve(null);
  });
  mockUpdate.mockResolvedValue({});
  mockTokenDeleteMany.mockResolvedValue({ count: 0 });
});

describe("PATCH setPassword", () => {
  it("hashes the password, requires a change at next sign-in and drops pending reset links", async () => {
    const res = await setPassword({ mustChangePassword: true });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "target" },
      data: {
        password: "hashed:newpass1",
        mustChangePassword: true,
        sessionsValidFrom: expect.any(Date),
      },
    });
    expect(mockTokenDeleteMany).toHaveBeenCalledWith({
      where: { identifier: "password-reset:target" },
    });
    // The password and the revocation of the links commit together
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("answers 500 (translated) instead of rejecting when the write fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error("db down"));
    const res = await setPassword();
    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });

  it("clears the flag when the admin does not ask for a change (and when it is omitted)", async () => {
    await setPassword({ mustChangePassword: false });
    expect(mockUpdate).toHaveBeenLastCalledWith({
      where: { id: "target" },
      data: {
        password: "hashed:newpass1",
        mustChangePassword: false,
        sessionsValidFrom: expect.any(Date),
      },
    });
    await setPassword();
    expect(mockUpdate).toHaveBeenLastCalledWith({
      where: { id: "target" },
      data: {
        password: "hashed:newpass1",
        mustChangePassword: false,
        sessionsValidFrom: expect.any(Date),
      },
    });
  });

  it("refuses to set the admin's own password", async () => {
    const res = await PATCH(
      request("PATCH", { userId: "admin", action: "setPassword", password: "newpass1" })
    );
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses non-admins and anonymous callers", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "admin", isAdmin: false });
    expect((await setPassword()).status).toBe(403);
    mockSession.mockResolvedValue(null);
    expect((await setPassword()).status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["too short", "12345"],
    ["too long", "x".repeat(101)],
    ["not a string", 123456],
    ["missing", undefined],
  ])("rejects a password that is %s", async (_name, password) => {
    const res = await setPassword({ password });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PASSWORD_LENGTH");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean mustChangePassword", async () => {
    const res = await setPassword({ mustChangePassword: "true" });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown user", async () => {
    const res = await PATCH(
      request("PATCH", { userId: "ghost", action: "setPassword", password: "newpass1" })
    );
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a userId that is not a string", async () => {
    const res = await PATCH(
      request("PATCH", { userId: { id: "target" }, action: "setPassword", password: "newpass1" })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST create user with mustChangePassword", () => {
  const created = { id: "new", email: "n@b.co", name: null };
  beforeEach(() => mockCreate.mockResolvedValue(created));

  const create = (extra: object) =>
    POST(request("POST", { email: "n@b.co", password: "pass1234", ...extra }));

  it("stores the flag for a user created with a password", async () => {
    const res = await create({ mustChangePassword: true });
    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data.mustChangePassword).toBe(true);
  });

  it("ignores the flag for an SSO-only user (no password to replace)", async () => {
    const res = await create({ password: undefined, ssoAutoLink: true, mustChangePassword: true });
    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data.mustChangePassword).toBe(false);
  });

  it("rejects a non-boolean flag", async () => {
    expect((await create({ mustChangePassword: "yes" })).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
