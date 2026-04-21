/**
 * @jest-environment node
 */

/**
 * Tests for v1 share routes:
 *   GET/POST /api/v1/shares
 *   GET/DELETE /api/v1/shares/:slug
 */

jest.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@/lib/shares", () => ({
  createLinkShare: jest.fn(),
  createPasteShare: jest.fn(),
}));

jest.mock("@/lib/getClientIp", () => ({
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { GET as listShares, POST as createShare } from "@/app/api/v1/shares/route";
import { GET as getShare, DELETE as deleteShare } from "@/app/api/v1/shares/[slug]/route";
import { authenticateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createLinkShare, createPasteShare } from "@/lib/shares";
import { NextRequest } from "next/server";

const mockAuth = authenticateApiRequest as jest.Mock;
const mockShareFindMany = prisma.share.findMany as jest.Mock;
const mockShareFindUnique = prisma.share.findUnique as jest.Mock;
const mockShareDelete = prisma.share.delete as jest.Mock;
const mockCreateLink = createLinkShare as jest.Mock;
const mockCreatePaste = createPasteShare as jest.Mock;

const USER = { id: "user-1", name: "Alice", email: "alice@example.com", isAdmin: false };
const ADMIN = { id: "admin-1", name: "Admin", email: "admin@example.com", isAdmin: true };

function makeRequest(body?: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/v1/shares", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/v1/shares
// ---------------------------------------------------------------------------
describe("GET /api/v1/shares", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ user: null, authMethod: null });
    const res = await listShares(makeRequest(undefined, "GET"));
    expect(res.status).toBe(401);
  });

  it("returns the user's shares without filePath", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockShareFindMany.mockResolvedValue([
      { id: "s1", type: "URL", slug: "abc", urlOriginal: "https://example.com" },
    ]);

    const res = await listShares(makeRequest(undefined, "GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    // filePath must not be in the response
    expect(body.data[0].filePath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/shares — link
// ---------------------------------------------------------------------------
describe("POST /api/v1/shares — URL type", () => {
  it("returns 400 when type is missing", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    const res = await createShare(makeRequest({ urlOriginal: "https://example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when urlOriginal is missing", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    const res = await createShare(makeRequest({ type: "URL" }));
    expect(res.status).toBe(400);
  });

  it("creates a URL share and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockCreateLink.mockResolvedValue({ share: { slug: "my-link" } });

    const res = await createShare(makeRequest({ type: "URL", urlOriginal: "https://example.com" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.share.slug).toBe("my-link");
  });

  it("propagates errorCode from createLinkShare", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockCreateLink.mockResolvedValue({ errorCode: "INVALID_URL" });

    const res = await createShare(makeRequest({ type: "URL", urlOriginal: "not-a-url" }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/shares — paste
// ---------------------------------------------------------------------------
describe("POST /api/v1/shares — PASTE type", () => {
  it("returns 400 when paste content is missing", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    const res = await createShare(makeRequest({ type: "PASTE" }));
    expect(res.status).toBe(400);
  });

  it("creates a paste share and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockCreatePaste.mockResolvedValue({ share: { slug: "my-paste" } });

    const res = await createShare(makeRequest({ type: "PASTE", paste: "hello world" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.share.slug).toBe("my-paste");
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/shares/:slug
// ---------------------------------------------------------------------------
describe("GET /api/v1/shares/:slug", () => {
  const params = Promise.resolve({ slug: "abc" });

  it("returns 404 for unknown slug", async () => {
    mockShareFindUnique.mockResolvedValue(null);
    const res = await getShare(new NextRequest("http://localhost/api/v1/shares/abc"), { params });
    expect(res.status).toBe(404);
  });

  it("returns 410 for expired share", async () => {
    mockShareFindUnique.mockResolvedValue({
      id: "s1",
      slug: "abc",
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await getShare(new NextRequest("http://localhost/api/v1/shares/abc"), { params });
    expect(res.status).toBe(410);
  });

  it("returns share metadata without ownerId", async () => {
    mockShareFindUnique.mockResolvedValue({
      id: "s1",
      type: "URL",
      slug: "abc",
      expiresAt: null,
      createdAt: new Date(),
      maxViews: null,
      viewCount: 0,
      isBulk: false,
    });
    const res = await getShare(new NextRequest("http://localhost/api/v1/shares/abc"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.share.ownerId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/shares/:slug
// ---------------------------------------------------------------------------
describe("DELETE /api/v1/shares/:slug", () => {
  const params = Promise.resolve({ slug: "abc" });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ user: null, authMethod: null });
    const res = await deleteShare(new NextRequest("http://localhost/api/v1/shares/abc"), {
      params,
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown slug", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockShareFindUnique.mockResolvedValue(null);
    const res = await deleteShare(new NextRequest("http://localhost/api/v1/shares/abc"), {
      params,
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user does not own the share", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockShareFindUnique.mockResolvedValue({ id: "s1", slug: "abc", ownerId: "other-user" });
    const res = await deleteShare(new NextRequest("http://localhost/api/v1/shares/abc"), {
      params,
    });
    expect(res.status).toBe(403);
  });

  it("deletes the share and returns 204 for owner", async () => {
    mockAuth.mockResolvedValue({ user: USER, authMethod: "apikey" });
    mockShareFindUnique.mockResolvedValue({ id: "s1", slug: "abc", ownerId: "user-1" });
    mockShareDelete.mockResolvedValue({});
    const res = await deleteShare(new NextRequest("http://localhost/api/v1/shares/abc"), {
      params,
    });
    expect(res.status).toBe(204);
  });

  it("allows admin to delete any share", async () => {
    mockAuth.mockResolvedValue({ user: ADMIN, authMethod: "apikey" });
    mockShareFindUnique.mockResolvedValue({ id: "s1", slug: "abc", ownerId: "user-1" });
    mockShareDelete.mockResolvedValue({});
    const res = await deleteShare(new NextRequest("http://localhost/api/v1/shares/abc"), {
      params,
    });
    expect(res.status).toBe(204);
  });
});
