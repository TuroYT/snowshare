/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { share: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/email", () => ({ sendAccessNotificationEmail: jest.fn() }));
jest.mock("@/lib/ip-geolocation", () => ({ lookupIpGeolocation: jest.fn() }));

import { notifyShareOwner } from "@/lib/access-log";
import { prisma } from "@/lib/prisma";
import { sendAccessNotificationEmail } from "@/lib/email";
import { resetRateLimit } from "@/lib/rate-limit";

const findUnique = prisma.share.findUnique as jest.Mock;
const send = sendAccessNotificationEmail as jest.Mock;

describe("notifyShareOwner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimit("accessNotification", "s1");
    send.mockResolvedValue(true);
    process.env.NEXTAUTH_URL = "https://share.example.com";
  });

  it("does nothing when the owner has not opted in", async () => {
    findUnique.mockResolvedValue({
      slug: "abc",
      type: "FILE",
      owner: { email: "o@example.com", notifyOnAccess: false },
    });
    expect(await notifyShareOwner("s1")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing for anonymous shares", async () => {
    findUnique.mockResolvedValue({ slug: "abc", type: "FILE", owner: null });
    expect(await notifyShareOwner("s1")).toBe(false);
  });

  it("e-mails the owner once per share per hour", async () => {
    findUnique.mockResolvedValue({
      slug: "abc",
      type: "PASTE",
      owner: { email: "o@example.com", notifyOnAccess: true },
    });
    const at = new Date("2026-10-28T10:00:00Z");
    expect(await notifyShareOwner("s1", at)).toBe(true);
    expect(send).toHaveBeenCalledWith("o@example.com", "https://share.example.com/p/abc", at);

    expect(await notifyShareOwner("s1", at)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
