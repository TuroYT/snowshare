/**
 * @jest-environment node
 */

import { ErrorCode } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  isReverseShareOpen,
  releaseReverseShareSlot,
  toOwnerReverseShare,
  toPublicReverseShare,
  validateReverseShareInput,
} from "@/lib/reverse-shares";

jest.mock("@/lib/prisma", () => ({ prisma: { $executeRaw: jest.fn() } }));

const now = new Date("2026-10-28T12:00:00Z");

describe("validateReverseShareInput", () => {
  it("requires a name", () => {
    expect(validateReverseShareInput({ name: "  " }, now).errorCode).toBe(
      ErrorCode.INVALID_REQUEST
    );
  });

  it("rejects invalid slugs, short passwords, past dates and non-positive limits", () => {
    expect(validateReverseShareInput({ name: "x", slug: "a b" }, now).errorCode).toBe(
      ErrorCode.SLUG_INVALID
    );
    expect(validateReverseShareInput({ name: "x", password: "12" }, now).errorCode).toBe(
      ErrorCode.PASSWORD_INVALID_LENGTH
    );
    expect(
      validateReverseShareInput({ name: "x", expiresAt: "2026-10-27T00:00:00Z" }, now).errorCode
    ).toBe(ErrorCode.EXPIRATION_IN_PAST);
    expect(validateReverseShareInput({ name: "x", maxUploads: 0 }, now).errorCode).toBe(
      ErrorCode.INVALID_REQUEST
    );
    expect(validateReverseShareInput({ name: "x", maxSizeMB: "1.5" }, now).errorCode).toBe(
      ErrorCode.INVALID_REQUEST
    );
  });

  it("rejects limits that do not fit a database integer", () => {
    expect(validateReverseShareInput({ name: "x", maxUploads: 2147483648 }, now).errorCode).toBe(
      ErrorCode.INVALID_REQUEST
    );
    expect(validateReverseShareInput({ name: "x", maxSizeMB: 2147483648 }, now).errorCode).toBe(
      ErrorCode.INVALID_REQUEST
    );
    expect(validateReverseShareInput({ name: "x", maxUploads: 2147483647 }, now).errorCode).toBe(
      undefined
    );
  });

  it("normalizes optional fields", () => {
    const r = validateReverseShareInput(
      { name: " Photos ", maxUploads: "3", maxSizeMB: "", expiresAt: "2026-11-01T00:00:00Z" },
      now
    );
    expect(r.data).toEqual({
      name: "Photos",
      slug: null,
      password: null,
      expiresAt: new Date("2026-11-01T00:00:00Z"),
      maxUploads: 3,
      maxSizeMB: null,
    });
  });
});

describe("reverse share views", () => {
  const row = {
    id: "r1",
    slug: "abc",
    ownerId: "u1",
    name: "Photos",
    password: "hash",
    expiresAt: null,
    maxUploads: 2,
    maxSizeMB: 10,
    uploadCount: 1,
    createdAt: now,
  };

  it("never exposes the password hash", () => {
    expect(toOwnerReverseShare(row)).not.toHaveProperty("password");
    expect(toOwnerReverseShare(row).hasPassword).toBe(true);
    expect(toPublicReverseShare(row, now)).toEqual({
      name: "Photos",
      requiresPassword: true,
      expiresAt: null,
      maxSizeMB: 10,
      isOpen: true,
    });
  });

  it("closes when full or expired", () => {
    expect(isReverseShareOpen({ ...row, uploadCount: 2 }, now)).toBe(false);
    expect(isReverseShareOpen({ ...row, expiresAt: now }, now)).toBe(false);
    expect(isReverseShareOpen({ ...row, maxUploads: null, uploadCount: 99 }, now)).toBe(true);
  });
});

describe("releaseReverseShareSlot", () => {
  const executeRaw = prisma.$executeRaw as unknown as jest.Mock;

  beforeEach(() => executeRaw.mockReset());

  it("retries after a transient database failure", async () => {
    executeRaw.mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce(1);
    await releaseReverseShareSlot("r1");
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it("gives up and logs after a few failed attempts", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    executeRaw.mockRejectedValue(new Error("down"));
    await expect(releaseReverseShareSlot("r1")).resolves.toBeUndefined();
    expect(executeRaw).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
