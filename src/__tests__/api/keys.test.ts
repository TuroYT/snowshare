/**
 * @jest-environment node
 */

/**
 * Tests for API key management routes (GET/POST /api/keys, DELETE /api/keys/:id)
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/security", () => ({
  generateApiKey: jest.fn(() => ({
    raw: "sk_testrawkey1234",
    hash: "abc123hash",
    prefix: "sk_testraw",
  })),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { GET as getKeys, POST as postKey } from "@/app/api/keys/route";
import { DELETE as deleteKey } from "@/app/api/keys/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

const mockFindMany = prisma.apiKey.findMany as jest.Mock;
const mockCreate = prisma.apiKey.create as jest.Mock;
const mockCount = prisma.apiKey.count as jest.Mock;
const mockFindUnique = prisma.apiKey.findUnique as jest.Mock;
const mockDelete = prisma.apiKey.delete as jest.Mock;
const mockGetSession = getServerSession as jest.Mock;

const SESSION = { user: { id: "user-1" } };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/keys", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/keys", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await getKeys(new NextRequest("http://localhost/api/keys"));
    expect(res.status).toBe(401);
  });

  it("returns list of keys for authenticated user", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockFindMany.mockResolvedValue([{ id: "k1", name: "My key", keyPrefix: "sk_abc123" }]);

    const res = await getKeys(new NextRequest("http://localhost/api/keys"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("My key");
  });
});

describe("POST /api/keys", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await postKey(makeRequest({ name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(0);
    const res = await postKey(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 64 characters", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(0);
    const res = await postKey(makeRequest({ name: "a".repeat(65) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when expiresAt is in the past", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(0);
    const res = await postKey(
      makeRequest({ name: "Test", expiresAt: new Date(Date.now() - 1000).toISOString() })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when expiresAt is an invalid date", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(0);
    const res = await postKey(makeRequest({ name: "Test", expiresAt: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user already has 20 keys", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(20);
    const res = await postKey(makeRequest({ name: "One more" }));
    expect(res.status).toBe(403);
  });

  it("creates a key and returns 201 with raw token", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({
      id: "key-1",
      name: "My script",
      keyPrefix: "sk_testraw",
      expiresAt: null,
      createdAt: new Date(),
    });

    const res = await postKey(makeRequest({ name: "My script" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.token).toBe("sk_testrawkey1234");
    expect(body.apiKey.name).toBe("My script");
  });
});

describe("DELETE /api/keys/:id", () => {
  const params = Promise.resolve({ id: "key-1" });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await deleteKey(new NextRequest("http://localhost/api/keys/key-1"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when key does not exist", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockFindUnique.mockResolvedValue(null);
    const res = await deleteKey(new NextRequest("http://localhost/api/keys/key-1"), { params });
    expect(res.status).toBe(404);
  });

  it("returns 403 when key belongs to another user", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockFindUnique.mockResolvedValue({ id: "key-1", userId: "other-user" });
    const res = await deleteKey(new NextRequest("http://localhost/api/keys/key-1"), { params });
    expect(res.status).toBe(403);
  });

  it("deletes the key and returns 204", async () => {
    mockGetSession.mockResolvedValue(SESSION);
    mockFindUnique.mockResolvedValue({ id: "key-1", userId: "user-1" });
    mockDelete.mockResolvedValue({});
    const res = await deleteKey(new NextRequest("http://localhost/api/keys/key-1"), { params });
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "key-1" } });
  });
});
