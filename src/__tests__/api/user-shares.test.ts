/**
 * @jest-environment node
 */

/**
 * Tests for user shares API routes
 * GET /api/user/shares
 * DELETE /api/user/shares/[id]
 * PATCH /api/user/shares/[id]
 */

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("fs/promises", () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((p: string) => Promise.resolve(`hashed:${p}`)),
}));

jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { GET } from "@/app/api/user/shares/route";
import { DELETE, PATCH } from "@/app/api/user/shares/[id]/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { NextRequest } from "next/server";

const mockGetServerSession = getServerSession as jest.Mock;
const mockShareFindMany = prisma.share.findMany as jest.Mock;
const mockShareFindUnique = prisma.share.findUnique as jest.Mock;
const mockShareDelete = prisma.share.delete as jest.Mock;
const mockShareUpdate = prisma.share.update as jest.Mock;
const mockUnlink = unlink as jest.Mock;

function makeRequest(
  body?: Record<string, unknown>,
  headers: Record<string, string> = {}
): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body ?? {}),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/user/shares", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockShareFindMany.mockResolvedValue([]);
  });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("should return 200 with an empty list when user has no shares", async () => {
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.shares).toEqual([]);
  });

  it("should return the user's shares", async () => {
    const shares = [
      {
        id: "share-1",
        type: "PASTE",
        slug: "my-paste",
        paste: "console.log('hello')",
        pastelanguage: "JAVASCRIPT",
        urlOriginal: null,
        filePath: null,
        password: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        maxViews: null,
        viewCount: 0,
      },
    ];
    mockShareFindMany.mockResolvedValue(shares);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.shares).toHaveLength(1);
    expect(data.shares[0].id).toBe("share-1");
  });

  it("should only fetch shares for the authenticated user", async () => {
    await GET(makeRequest());

    expect(mockShareFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: "user-1" }),
      })
    );
  });

  it("should order shares by createdAt desc", async () => {
    await GET(makeRequest());

    expect(mockShareFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("should return 500 on database error", async () => {
    mockShareFindMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/user/shares/[id]", () => {
  const shareId = "share-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockShareFindUnique.mockResolvedValue({
      id: shareId,
      ownerId: "user-1",
      type: "PASTE",
      filePath: null,
    });
    mockShareDelete.mockResolvedValue({});
  });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const response = await DELETE(makeRequest(), makeParams(shareId));
    expect(response.status).toBe(401);
  });

  it("should return 404 when the share does not exist", async () => {
    mockShareFindUnique.mockResolvedValue(null);
    const response = await DELETE(makeRequest(), makeParams(shareId));
    expect(response.status).toBe(404);
  });

  it("should return 403 when the share belongs to another user", async () => {
    mockShareFindUnique.mockResolvedValue({
      id: shareId,
      ownerId: "other-user",
      type: "PASTE",
      filePath: null,
    });
    const response = await DELETE(makeRequest(), makeParams(shareId));
    expect(response.status).toBe(403);
  });

  it("should delete the share and return success", async () => {
    const response = await DELETE(makeRequest(), makeParams(shareId));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockShareDelete).toHaveBeenCalledWith({ where: { id: shareId } });
  });

  it("should attempt to delete the file when the share is a FILE type", async () => {
    mockShareFindUnique.mockResolvedValue({
      id: shareId,
      ownerId: "user-1",
      type: "FILE",
      filePath: "abc123_document.pdf",
    });

    const response = await DELETE(makeRequest(), makeParams(shareId));

    expect(response.status).toBe(200);
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("should still delete the DB record even if file deletion fails", async () => {
    mockUnlink.mockRejectedValueOnce(new Error("File not found"));

    mockShareFindUnique.mockResolvedValue({
      id: shareId,
      ownerId: "user-1",
      type: "FILE",
      filePath: "abc123_document.pdf",
    });

    const response = await DELETE(makeRequest(), makeParams(shareId));

    expect(response.status).toBe(200);
    expect(mockShareDelete).toHaveBeenCalled();
  });

  it("should return 500 on unexpected database error", async () => {
    mockShareDelete.mockRejectedValue(new Error("DB error"));
    const response = await DELETE(makeRequest(), makeParams(shareId));
    expect(response.status).toBe(500);
  });
});

describe("PATCH /api/user/shares/[id]", () => {
  const shareId = "share-123";
  const existingPasteShare = {
    id: shareId,
    ownerId: "user-1",
    type: "PASTE",
    filePath: null,
  };
  const existingUrlShare = {
    id: shareId,
    ownerId: "user-1",
    type: "URL",
    filePath: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockShareFindUnique.mockResolvedValue(existingPasteShare);
    mockShareUpdate.mockResolvedValue({ ...existingPasteShare, paste: "updated" });
  });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const response = await PATCH(makeRequest({ paste: "updated" }), makeParams(shareId));
    expect(response.status).toBe(401);
  });

  it("should return 404 when the share does not exist", async () => {
    mockShareFindUnique.mockResolvedValue(null);
    const response = await PATCH(makeRequest({ paste: "updated" }), makeParams(shareId));
    expect(response.status).toBe(404);
  });

  it("should return 403 when the share belongs to another user", async () => {
    mockShareFindUnique.mockResolvedValue({ ...existingPasteShare, ownerId: "other-user" });
    const response = await PATCH(makeRequest({ paste: "updated" }), makeParams(shareId));
    expect(response.status).toBe(403);
  });

  it("should update the paste content", async () => {
    const response = await PATCH(makeRequest({ paste: "new content" }), makeParams(shareId));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.share).toBeDefined();
    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paste: "new content" }),
      })
    );
  });

  it("should update the expiration date", async () => {
    const newDate = new Date(Date.now() + 86400000).toISOString();
    await PATCH(makeRequest({ expiresAt: newDate }), makeParams(shareId));

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: expect.any(Date) }),
      })
    );
  });

  it("should clear the expiration date when null is provided", async () => {
    await PATCH(makeRequest({ expiresAt: null }), makeParams(shareId));

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: null }),
      })
    );
  });

  it("should hash the password when updating", async () => {
    await PATCH(makeRequest({ password: "newpassword" }), makeParams(shareId));

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: "hashed:newpassword" }),
      })
    );
  });

  it("should clear the password when empty string is provided", async () => {
    await PATCH(makeRequest({ password: "" }), makeParams(shareId));

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: null }),
      })
    );
  });

  it("should reject a password that is too short (< 6 chars)", async () => {
    const response = await PATCH(makeRequest({ password: "abc" }), makeParams(shareId));
    expect(response.status).toBe(400);
    expect(mockShareUpdate).not.toHaveBeenCalled();
  });

  it("should reject a password that is too long (> 100 chars)", async () => {
    const response = await PATCH(makeRequest({ password: "a".repeat(101) }), makeParams(shareId));
    expect(response.status).toBe(400);
    expect(mockShareUpdate).not.toHaveBeenCalled();
  });

  it("should reject an invalid paste language", async () => {
    const response = await PATCH(
      makeRequest({ pastelanguage: "INVALID_LANG" }),
      makeParams(shareId)
    );
    expect(response.status).toBe(400);
    expect(mockShareUpdate).not.toHaveBeenCalled();
  });

  it("should accept a valid paste language", async () => {
    await PATCH(makeRequest({ pastelanguage: "JAVASCRIPT" }), makeParams(shareId));

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pastelanguage: "JAVASCRIPT" }),
      })
    );
  });

  it("should update the URL for a URL share type", async () => {
    mockShareFindUnique.mockResolvedValue(existingUrlShare);
    mockShareUpdate.mockResolvedValue({ ...existingUrlShare, urlOriginal: "https://new.com" });

    await PATCH(makeRequest({ urlOriginal: "https://new.com" }), makeParams(shareId));

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ urlOriginal: "https://new.com" }),
      })
    );
  });

  it("should reject an invalid URL for a URL share type", async () => {
    mockShareFindUnique.mockResolvedValue(existingUrlShare);

    const response = await PATCH(
      makeRequest({ urlOriginal: "not-a-valid-url" }),
      makeParams(shareId)
    );
    expect(response.status).toBe(400);
    expect(mockShareUpdate).not.toHaveBeenCalled();
  });

  it("should return 500 on unexpected database error", async () => {
    mockShareUpdate.mockRejectedValue(new Error("DB error"));
    const response = await PATCH(makeRequest({ paste: "updated" }), makeParams(shareId));
    expect(response.status).toBe(500);
  });
});
