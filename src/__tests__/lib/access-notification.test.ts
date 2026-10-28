/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { share: { findUnique: jest.fn(), updateMany: jest.fn() } },
}));
jest.mock("@/lib/email", () => ({ sendAccessNotificationEmail: jest.fn() }));
jest.mock("@/lib/ip-geolocation", () => ({ lookupIpGeolocation: jest.fn() }));

import { notifyShareOwner } from "@/lib/access-log";
import { prisma } from "@/lib/prisma";
import { sendAccessNotificationEmail } from "@/lib/email";
import { resetRateLimit } from "@/lib/rate-limit";

const findUnique = prisma.share.findUnique as jest.Mock;
const updateMany = prisma.share.updateMany as jest.Mock;
const send = sendAccessNotificationEmail as jest.Mock;

describe("notifyShareOwner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimit("accessNotification", "u1");
    updateMany.mockResolvedValue({ count: 1 });
    send.mockResolvedValue(true);
    process.env.NEXTAUTH_URL = "https://share.example.com";
  });

  it("does nothing when the owner has not opted in", async () => {
    findUnique.mockResolvedValue({
      slug: "abc",
      type: "FILE",
      ownerId: "u1",
      owner: { email: "o@example.com", notifyOnAccess: false },
    });
    expect(await notifyShareOwner("s1")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing for anonymous shares", async () => {
    findUnique.mockResolvedValue({ slug: "abc", type: "FILE", ownerId: null, owner: null });
    expect(await notifyShareOwner("s1")).toBe(false);
  });

  const optedIn = {
    slug: "abc",
    type: "PASTE",
    ownerId: "u1",
    owner: { email: "o@example.com", notifyOnAccess: true },
  };

  it("e-mails the owner when the hourly slot is free", async () => {
    findUnique.mockResolvedValue(optedIn);
    const at = new Date("2026-10-28T10:00:00Z");
    expect(await notifyShareOwner("s1", at)).toBe(true);
    expect(send).toHaveBeenCalledWith("o@example.com", "https://share.example.com/p/abc", at);
    expect(updateMany.mock.calls[0][0].data).toEqual({ lastAccessNotifiedAt: at });
  });

  it("skips when the share was notified less than an hour ago", async () => {
    findUnique.mockResolvedValue(optedIn);
    updateMany.mockResolvedValue({ count: 0 });
    expect(await notifyShareOwner("s1")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("caps e-mails per owner across shares", async () => {
    findUnique.mockResolvedValue(optedIn);
    for (let i = 0; i < 20; i++) expect(await notifyShareOwner(`s${i}`)).toBe(true);
    expect(await notifyShareOwner("s99")).toBe(false);
    expect(send).toHaveBeenCalledTimes(20);
    // The exhausted budget did not claim the share's hourly slot
    expect(updateMany).toHaveBeenCalledTimes(20);
  });

  it("frees the hourly slot when the e-mail is not sent", async () => {
    findUnique.mockResolvedValue(optedIn);
    send.mockRejectedValue(new Error("smtp down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const at = new Date("2026-10-28T10:00:00Z");
    expect(await notifyShareOwner("s1", at)).toBe(false);
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { id: "s1", lastAccessNotifiedAt: at },
      data: { lastAccessNotifiedAt: null },
    });
  });
});
