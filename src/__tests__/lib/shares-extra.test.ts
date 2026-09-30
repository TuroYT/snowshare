/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({
  prisma: { share: { create: jest.fn(), findUnique: jest.fn() } },
}));
jest.mock("@/lib/settings", () => ({ getSettingsCached: jest.fn() }));
jest.mock("@/lib/crypto-link", () => ({
  encrypt: jest.fn((text: string, pw: string) => `enc_${text}_${pw}`),
}));
jest.mock("@/lib/ip-geolocation", () => ({ lookupIpGeolocation: jest.fn() }));
jest.mock("@/lib/security", () => ({
  hashPassword: jest.fn((p: string) => Promise.resolve(`hashed_${p}`)),
  isValidSlug: jest.requireActual("@/lib/security").isValidSlug,
  resolveAnonExpiry: jest.requireActual("@/lib/security").resolveAnonExpiry,
  generateRandomSlug: jest.fn(() => Promise.resolve("random-slug")),
  MAX_ANON_EXPIRY_DAYS: 7,
}));

import { NextRequest } from "next/server";
import {
  createFileShare,
  createLinkShare,
  createPasteShare,
  getContextFromRequest,
} from "@/lib/shares";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
import { generateRandomSlug } from "@/lib/security";
import { MAX_PASTE_SIZE } from "@/lib/constants";
import { ErrorCode } from "@/lib/api-errors";

const mockCreate = prisma.share.create as jest.Mock;
const mockFindUnique = prisma.share.findUnique as jest.Mock;
const mockSettings = getSettingsCached as jest.Mock;

const anon = { userId: null, isAuthenticated: false, ip: "1.2.3.4" };
const authed = { userId: "u1", isAuthenticated: true, ip: "1.2.3.4" };
const inDays = (d: number) => new Date(Date.now() + d * 86400000);

describe("shares service (extra branches)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockImplementation(({ data }) => Promise.resolve({ id: "s1", ...data }));
    mockSettings.mockResolvedValue({
      allowAnonLinkShare: true,
      allowAnonPasteShare: true,
      allowAnonFileShare: true,
    });
  });

  describe("getContextFromRequest", () => {
    it("builds an anonymous context", () => {
      const request = new NextRequest("http://localhost/x", {
        headers: { "x-snowshare-client-ip": "9.9.9.9" },
      });
      const ctx = getContextFromRequest(request);
      expect(ctx.userId).toBeNull();
      expect(ctx.isAuthenticated).toBe(false);
      expect(ctx.ip).toBe("9.9.9.9");
    });

    it("builds an authenticated context from a user id", () => {
      const ctx = getContextFromRequest(new NextRequest("http://localhost/x"), "u1");
      expect(ctx.userId).toBe("u1");
      expect(ctx.isAuthenticated).toBe(true);
    });
  });

  describe("shared validation", () => {
    it("rejects an invalid Date as expiration", async () => {
      const r = await createLinkShare({
        urlOriginal: "https://example.com",
        context: authed,
        expiresAt: new Date("invalid"),
      });
      expect(r.errorCode).toBe(ErrorCode.INVALID_REQUEST);
    });

    it("rejects a duplicate slug and an invalid slug", async () => {
      mockFindUnique.mockResolvedValue({ id: "x" });
      const taken = await createFileShare({
        filename: "a",
        filePath: "p",
        context: authed,
        slug: "taken-slug",
      });
      expect(taken.errorCode).toBe(ErrorCode.SLUG_ALREADY_TAKEN);
      const invalid = await createFileShare({
        filename: "a",
        filePath: "p",
        context: authed,
        slug: "!!",
      });
      expect(invalid.errorCode).toBe(ErrorCode.SLUG_INVALID);
    });

    it("treats missing settings as anonymous shares allowed", async () => {
      mockSettings.mockResolvedValue(null);
      const r = await createLinkShare({
        urlOriginal: "https://example.com",
        context: anon,
        expiresAt: inDays(1),
      });
      expect(r.share).toBeDefined();
    });

    it("rejects anonymous expiration that is too far", async () => {
      const r = await createPasteShare({
        paste: "x",
        pastelanguage: "PLAINTEXT",
        context: anon,
        expiresAt: inDays(30),
      });
      expect(r.errorCode).toBe(ErrorCode.EXPIRATION_TOO_FAR);
    });
  });

  describe("createPasteShare", () => {
    it("rejects oversized pastes", async () => {
      const r = await createPasteShare({
        paste: "x".repeat(MAX_PASTE_SIZE + 1),
        pastelanguage: "PLAINTEXT",
        context: authed,
      });
      expect(r.errorCode).toBe(ErrorCode.FILE_TOO_LARGE);
      expect(r.params).toBeDefined();
    });

    it("rejects empty pastes", async () => {
      const r = await createPasteShare({ paste: "", pastelanguage: "PLAINTEXT", context: authed });
      expect(r.errorCode).toBe(ErrorCode.PASTE_CONTENT_EMPTY);
    });

    it("rejects an invalid language", async () => {
      const r = await createPasteShare({ paste: "x", pastelanguage: "", context: authed });
      expect(r.errorCode).toBe(ErrorCode.PASTE_LANGUAGE_INVALID);
    });

    it("blocks anonymous pastes when disabled or without expiration", async () => {
      mockSettings.mockResolvedValue({ allowAnonPasteShare: false });
      const disabled = await createPasteShare({
        paste: "x",
        pastelanguage: "PLAINTEXT",
        context: anon,
        expiresAt: inDays(1),
      });
      expect(disabled.errorCode).toBe(ErrorCode.ANON_PASTE_SHARE_DISABLED);
      mockSettings.mockResolvedValue({ allowAnonPasteShare: true });
      const noExpiry = await createPasteShare({
        paste: "x",
        pastelanguage: "PLAINTEXT",
        context: anon,
      });
      expect(noExpiry.errorCode).toBe(ErrorCode.EXPIRATION_REQUIRED);
    });

    it("creates a password protected paste with a generated slug", async () => {
      const r = await createPasteShare({
        paste: "x",
        pastelanguage: "PLAINTEXT",
        context: authed,
        password: "password123",
        maxViews: 3,
      });
      expect(r.share).toBeDefined();
      expect(generateRandomSlug).toHaveBeenCalled();
      expect(mockCreate.mock.calls[0][0].data).toMatchObject({
        slug: "random-slug",
        password: "hashed_password123",
        maxViews: 3,
        type: "PASTE",
      });
    });
  });

  describe("createFileShare", () => {
    it("creates a file share with a size and generated slug", async () => {
      const r = await createFileShare({
        filename: "a.txt",
        filePath: "id_a.txt",
        size: 123,
        context: authed,
        password: "password123",
        maxViews: 2,
      });
      expect(r.share).toBeDefined();
      expect(mockCreate.mock.calls[0][0].data).toMatchObject({
        filePath: "id_a.txt",
        size: BigInt(123),
        slug: "random-slug",
        type: "FILE",
        password: "hashed_password123",
        maxViews: 2,
        ownerId: "u1",
      });
    });

    it("stores null size and max views when not provided or invalid", async () => {
      await createFileShare({
        filename: "a",
        filePath: "p",
        context: authed,
        slug: "my-slug",
        maxViews: -1,
      });
      expect(mockCreate.mock.calls[0][0].data).toMatchObject({
        size: null,
        maxViews: null,
        password: null,
        slug: "my-slug",
      });
    });

    it("rejects invalid expiration and password length", async () => {
      const past = await createFileShare({
        filename: "a",
        filePath: "p",
        context: authed,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(past.errorCode).toBe(ErrorCode.EXPIRATION_IN_PAST);
      const pw = await createFileShare({
        filename: "a",
        filePath: "p",
        context: authed,
        password: "a",
      });
      expect(pw.errorCode).toBe(ErrorCode.PASSWORD_INVALID_LENGTH);
    });

    it("blocks anonymous file shares when disabled", async () => {
      mockSettings.mockResolvedValue({ allowAnonFileShare: false });
      const r = await createFileShare({ filename: "a", filePath: "p", context: anon });
      expect(r.errorCode).toBe(ErrorCode.ANON_FILE_SHARE_DISABLED);
    });

    it("rejects anonymous expiration beyond the maximum", async () => {
      const r = await createFileShare({
        filename: "a",
        filePath: "p",
        context: anon,
        expiresAt: inDays(30),
      });
      expect(r.errorCode).toBe(ErrorCode.EXPIRATION_TOO_FAR);
    });

    it("defaults anonymous shares to the maximum expiry", async () => {
      const r = await createFileShare({ filename: "a", filePath: "p", context: anon });
      expect(r.share).toBeDefined();
      expect(mockCreate.mock.calls[0][0].data.expiresAt).toBeInstanceOf(Date);
    });

    it("accepts anonymous shares with a valid expiration", async () => {
      const expiresAt = inDays(2);
      await createFileShare({ filename: "a", filePath: "p", context: anon, expiresAt });
      expect(mockCreate.mock.calls[0][0].data.expiresAt).toBe(expiresAt);
    });
  });
});
