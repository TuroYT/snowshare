/**
 * @jest-environment node
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: { share: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((p: string) => Promise.resolve(`hashed:${p}`)),
}));
jest.mock("@/lib/i18n-server", () => ({
  detectLocale: jest.fn(() => "en"),
  translate: jest.fn((_locale: string, key: string) => key),
}));

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto-link";
import { toUserShare } from "@/lib/user-shares";
import { PATCH } from "@/app/api/user/shares/[id]/route";

const findUnique = prisma.share.findUnique as jest.Mock;
const update = prisma.share.update as jest.Mock;

function patch(body: Record<string, unknown>) {
  const request = {
    url: "http://localhost/api/user/shares/s1",
    json: jest.fn().mockResolvedValue(body),
    headers: { get: () => null },
  } as unknown as NextRequest;
  return PATCH(request, { params: Promise.resolve({ id: "s1" }) });
}

const encryptedShare = {
  ownerId: "u1",
  type: "PASTE",
  password: "hashed:old-pass",
  urlOriginal: null,
  paste: encrypt("secret content", "old-pass"),
  pasteEncrypted: true,
};

describe("PATCH on an encrypted paste", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(encryptedShare);
    update.mockResolvedValue({
      ...encryptedShare,
      id: "s1",
      slug: "abc",
      _count: { accessLogs: 0 },
    });
  });

  it("requires the content to change or remove the password", async () => {
    const res = await patch({ password: "new-pass" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("api.errors.paste_content_required_for_password_change");
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a password to change the content", async () => {
    const res = await patch({ paste: "new content" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("api.errors.paste_password_required_for_content_change");
  });

  it("re-encrypts the content with the new password", async () => {
    expect((await patch({ paste: "new content", password: "new-pass" })).status).toBe(200);
    const data = update.mock.calls[0][0].data;
    expect(data.pasteEncrypted).toBe(true);
    expect(data.paste).not.toContain("new content");
    expect(decrypt(data.paste, "new-pass")).toBe("new content");
    expect(data.password).toBe("hashed:new-pass");
  });

  it("stores plaintext when the password is removed", async () => {
    expect((await patch({ paste: "now public", password: "" })).status).toBe(200);
    expect(update.mock.calls[0][0].data).toMatchObject({
      paste: "now public",
      pasteEncrypted: false,
      password: null,
    });
  });

  it("allows changing only the language", async () => {
    expect((await patch({ pastelanguage: "PYTHON" })).status).toBe(200);
    expect(update.mock.calls[0][0].data).toEqual({ pastelanguage: "PYTHON" });
  });

  it("encrypts a plaintext paste when a password is added", async () => {
    findUnique.mockResolvedValue({
      ...encryptedShare,
      password: null,
      paste: "hello",
      pasteEncrypted: false,
    });
    expect((await patch({ password: "fresh-pass" })).status).toBe(200);
    expect(decrypt(update.mock.calls[0][0].data.paste, "fresh-pass")).toBe("hello");
  });
});

describe("toUserShare", () => {
  it("never returns encrypted paste content", () => {
    const row = {
      id: "s1",
      type: "PASTE" as const,
      slug: "abc",
      filePath: null,
      isBulk: false,
      paste: "v2:...",
      pasteEncrypted: true,
      pastelanguage: null,
      urlOriginal: null,
      password: "hash",
      createdAt: new Date(),
      expiresAt: null,
      maxViews: null,
      viewCount: 0,
      _count: { accessLogs: 0 },
    };
    expect(toUserShare(row).paste).toBeNull();
    expect(toUserShare({ ...row, paste: "hi", pasteEncrypted: false }).paste).toBe("hi");
  });
});
