/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: {
    share: {
      updateMany: jest.fn(),
      fields: { maxViews: "maxViews" },
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  checkShareAvailability,
  consumeView,
  createDownloadToken,
  DOWNLOAD_TOKEN_TTL_SECONDS,
  verifyDownloadToken,
} from "@/lib/share-access";

const IP = "203.0.113.7";

describe("download tokens", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("verifies a token for the same share, purpose and client IP", () => {
    const token = createDownloadToken("share-1", "download", IP);
    expect(verifyDownloadToken(token, "share-1", IP)).toBe("download");
  });

  it("rejects a token used for another share", () => {
    const token = createDownloadToken("share-1", "download", IP);
    expect(verifyDownloadToken(token, "share-2", IP)).toBeNull();
  });

  it("rejects a token replayed from another IP", () => {
    const token = createDownloadToken("share-1", "download", IP);
    expect(verifyDownloadToken(token, "share-1", "198.51.100.1")).toBeNull();
  });

  it("rejects a token whose purpose was tampered with", () => {
    const token = createDownloadToken("share-1", "access", IP);
    const forged = token.replace(/^access\./, "download.");
    expect(verifyDownloadToken(forged, "share-1", IP)).toBeNull();
  });

  it("rejects an expired token", () => {
    jest.useFakeTimers();
    const token = createDownloadToken("share-1", "download", IP);

    jest.advanceTimersByTime((DOWNLOAD_TOKEN_TTL_SECONDS + 1) * 1000);

    expect(verifyDownloadToken(token, "share-1", IP)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyDownloadToken("garbage", "share-1", IP)).toBeNull();
    expect(verifyDownloadToken("download.1.sig", "share-1", IP)).toBeNull();
    expect(verifyDownloadToken(null, "share-1", IP)).toBeNull();
  });
});

describe("share availability and view counting", () => {
  it("treats a share with no views left as expired unless the limit is ignored", () => {
    const share = { expiresAt: null, maxViews: 1, viewCount: 1 };
    expect(checkShareAvailability(share)).not.toBeNull();
    expect(checkShareAvailability(share, { ignoreViewLimit: true })).toBeNull();
  });

  it("treats a share past its expiration as expired even with a token", () => {
    const share = { expiresAt: new Date(Date.now() - 1000), maxViews: null, viewCount: 0 };
    expect(checkShareAvailability(share, { ignoreViewLimit: true })).not.toBeNull();
  });

  it("consumeView reports whether a view was counted", async () => {
    (prisma.share.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    await expect(consumeView("share-1")).resolves.toBe(true);

    (prisma.share.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
    await expect(consumeView("share-1")).resolves.toBe(false);
  });
});
