/**
 * @jest-environment node
 */

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
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

import { POST } from "@/app/api/admin/users/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const adminSession = { user: { id: "admin-id" } };

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(adminSession);
    (prisma.user.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === "admin-id") return Promise.resolve({ id: "admin-id", isAdmin: true });
        return Promise.resolve(null);
      }
    );
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: "new-id",
      email: "user@test.com",
      name: null,
      isAdmin: false,
      createdAt: new Date(),
      _count: { shares: 0 },
    });
  });

  it("creates user with password (default flow)", async () => {
    const res = await POST(makeRequest({ email: "user@test.com", password: "password123" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe("user@test.com");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: "hashed:password123", ssoAutoLink: false }),
      })
    );
  });

  it("creates SSO-only user without password when ssoAutoLink is true", async () => {
    const res = await POST(makeRequest({ email: "sso@test.com", ssoAutoLink: true }));
    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: undefined, ssoAutoLink: true }),
      })
    );
  });

  it("returns 400 when password missing and ssoAutoLink is false", async () => {
    const res = await POST(makeRequest({ email: "user@test.com" }));
    expect(res.status).toBe(400);
  });
});
