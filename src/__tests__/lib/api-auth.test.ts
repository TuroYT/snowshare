/**
 * @jest-environment node
 */

/**
 * Tests for API request authentication (api-auth.ts)
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { authenticateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

const mockApikeyFindUnique = prisma.apiKey.findUnique as jest.Mock;
const mockApikeyUpdate = prisma.apiKey.update as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockGetServerSession = getServerSession as jest.Mock;

const VALID_KEY = "sk_aabbccdd11223344aabbccdd11223344";
const MOCK_USER = { id: "user-1", name: "Alice", email: "alice@example.com", isAdmin: false };

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost/api/v1/shares", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApikeyUpdate.mockResolvedValue({});
});

describe("authenticateApiRequest — API key auth", () => {
  it("returns the user when a valid, non-expired API key is provided", async () => {
    mockApikeyFindUnique.mockResolvedValue({
      id: "key-1",
      expiresAt: null,
      user: MOCK_USER,
    });

    const result = await authenticateApiRequest(makeRequest(`Bearer ${VALID_KEY}`));

    expect(result.authMethod).toBe("apikey");
    expect(result.user).toEqual(MOCK_USER);
  });

  it("returns null for an expired API key", async () => {
    mockApikeyFindUnique.mockResolvedValue({
      id: "key-1",
      expiresAt: new Date(Date.now() - 1000),
      user: MOCK_USER,
    });

    const result = await authenticateApiRequest(makeRequest(`Bearer ${VALID_KEY}`));

    expect(result.user).toBeNull();
    expect(result.authMethod).toBeNull();
  });

  it("returns null for an unknown API key", async () => {
    mockApikeyFindUnique.mockResolvedValue(null);

    const result = await authenticateApiRequest(makeRequest(`Bearer ${VALID_KEY}`));

    expect(result.user).toBeNull();
    expect(result.authMethod).toBeNull();
  });

  it("ignores bearer tokens that do not start with sk_", async () => {
    const result = await authenticateApiRequest(makeRequest("Bearer not-a-valid-key"));

    expect(mockApikeyFindUnique).not.toHaveBeenCalled();
    expect(result.authMethod).toBeNull();
  });

  it("fires lastUsedAt update asynchronously without blocking", async () => {
    mockApikeyFindUnique.mockResolvedValue({
      id: "key-1",
      expiresAt: null,
      user: MOCK_USER,
    });

    await authenticateApiRequest(makeRequest(`Bearer ${VALID_KEY}`));

    expect(mockApikeyUpdate).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});

describe("authenticateApiRequest — session auth fallback", () => {
  it("returns the user from a valid session when no API key is provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserFindUnique.mockResolvedValue(MOCK_USER);

    const result = await authenticateApiRequest(makeRequest());

    expect(result.authMethod).toBe("session");
    expect(result.user).toEqual(MOCK_USER);
  });

  it("returns null when session user is not found in DB", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "ghost" } });
    mockUserFindUnique.mockResolvedValue(null);

    const result = await authenticateApiRequest(makeRequest());

    expect(result.user).toBeNull();
    expect(result.authMethod).toBeNull();
  });

  it("returns null when there is no session and no API key", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await authenticateApiRequest(makeRequest());

    expect(result.user).toBeNull();
    expect(result.authMethod).toBeNull();
  });
});
