/**
 * @jest-environment node
 */

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/email", () => ({
  sendShareEmail: jest.fn(),
  isEmailEnabled: jest.fn(),
}));

import { POST } from "@/app/api/shares/send-email/route";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { sendShareEmail, isEmailEnabled } from "@/lib/email";
import { NextRequest } from "next/server";

const mockGetServerSession = getServerSession as jest.Mock;
const mockFindUnique = prisma.share.findUnique as jest.Mock;
const mockSendShareEmail = sendShareEmail as jest.Mock;
const mockIsEmailEnabled = isEmailEnabled as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/shares/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authenticatedSession = { user: { id: "user-1", name: "Alice" } };
const existingShare = { id: "share-1", slug: "abc123", shareType: "FILE" };

describe("POST /api/shares/send-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEmailEnabled.mockResolvedValue(true);
    mockSendShareEmail.mockResolvedValue(true);
    mockGetServerSession.mockResolvedValue(authenticatedSession);
    mockFindUnique.mockResolvedValue(existingShare);
  });

  it("should return 401 when user is not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ slug: "abc123", recipients: ["alice@example.com"] }));

    expect(res.status).toBe(401);
  });

  it("should return 503 when SMTP is not enabled", async () => {
    mockIsEmailEnabled.mockResolvedValue(false);

    const res = await POST(makeRequest({ slug: "abc123", recipients: ["alice@example.com"] }));

    expect(res.status).toBe(503);
  });

  it("should return 400 when slug is missing", async () => {
    const res = await POST(makeRequest({ recipients: ["alice@example.com"] }));

    expect(res.status).toBe(400);
  });

  it("should return 400 when recipients is empty", async () => {
    const res = await POST(makeRequest({ slug: "abc123", recipients: [] }));

    expect(res.status).toBe(400);
  });

  it("should return 400 when recipients is not an array", async () => {
    const res = await POST(makeRequest({ slug: "abc123", recipients: "alice@example.com" }));

    expect(res.status).toBe(400);
  });

  it("should return 400 when a recipient email is invalid", async () => {
    const res = await POST(makeRequest({ slug: "abc123", recipients: ["not-an-email"] }));

    expect(res.status).toBe(400);
  });

  it("should return 404 when the share does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ slug: "abc123", recipients: ["alice@example.com"] }));

    expect(res.status).toBe(404);
  });

  it("should call sendShareEmail with the correct arguments on success", async () => {
    const res = await POST(
      makeRequest({ slug: "abc123", recipients: ["alice@example.com", "bob@example.com"] })
    );

    expect(res.status).toBe(200);
    expect(mockSendShareEmail).toHaveBeenCalledWith(
      expect.stringContaining("abc123"),
      expect.any(String),
      ["alice@example.com", "bob@example.com"]
    );
  });

  it("should return 200 with a message property on success", async () => {
    const res = await POST(makeRequest({ slug: "abc123", recipients: ["alice@example.com"] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("message");
  });
});
