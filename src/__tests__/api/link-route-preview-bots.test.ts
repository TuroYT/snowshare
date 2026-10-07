/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { share: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/share-access", () => ({
  ...jest.requireActual("@/lib/share-access"),
  consumeView: jest.fn(),
}));
jest.mock("@/lib/access-log", () => ({ logShareAccess: jest.fn() }));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeView } from "@/lib/share-access";
import { GET } from "@/app/(shares)/l/[slug]/route";

const mockFindUnique = prisma.share.findUnique as jest.Mock;
const mockConsumeView = consumeView as jest.Mock;

const LINK = {
  id: "share-1",
  type: "URL",
  urlOriginal: "https://example.com/target",
  password: null,
  expiresAt: null,
  maxViews: 1,
  viewCount: 0,
};

function get(userAgent: string) {
  return GET(new NextRequest("http://localhost/l/abc", { headers: { "user-agent": userAgent } }));
}

describe("GET /l/[slug] with link preview bots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(LINK);
    mockConsumeView.mockResolvedValue(true);
  });

  it("answers bots with an empty page without consuming a view", async () => {
    const response = await get("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockConsumeView).not.toHaveBeenCalled();
  });

  it("still redirects browsers and counts the view", async () => {
    const response = await get("Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(LINK.urlOriginal);
    expect(mockConsumeView).toHaveBeenCalledWith("share-1");
  });
});
