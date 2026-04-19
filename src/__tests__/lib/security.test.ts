/**
 * Tests for security utilities (security.ts)
 */

jest.mock("bcryptjs", () => ({
  hash: jest.fn((password: string, cost: number) => Promise.resolve(`hashed:${password}:${cost}`)),
  compare: jest.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hashed:${password}:12`)
  ),
}));

import {
  hashPassword,
  verifyPassword,
  isValidSlug,
  SLUG_REGEX,
  BCRYPT_COST,
  MAX_ANON_EXPIRY_DAYS,
  getMaxAnonExpiry,
  resolveAnonExpiry,
  hashApiKey,
  generateApiKey,
} from "@/lib/security";
import bcrypt from "bcryptjs";

const mockHash = bcrypt.hash as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;

describe("hashPassword", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should call bcrypt.hash with the correct cost factor", async () => {
    await hashPassword("mypassword");
    expect(mockHash).toHaveBeenCalledWith("mypassword", BCRYPT_COST);
  });

  it("should return the hashed password", async () => {
    const hash = await hashPassword("secret");
    expect(hash).toBe(`hashed:secret:${BCRYPT_COST}`);
  });

  it("should use BCRYPT_COST = 12", () => {
    expect(BCRYPT_COST).toBe(12);
  });
});

describe("verifyPassword", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return true for a matching password", async () => {
    const result = await verifyPassword("secret", "hashed:secret:12");
    expect(mockCompare).toHaveBeenCalledWith("secret", "hashed:secret:12");
    expect(result).toBe(true);
  });

  it("should return false for a non-matching password", async () => {
    mockCompare.mockResolvedValueOnce(false);
    const result = await verifyPassword("wrong", "hashed:secret:12");
    expect(result).toBe(false);
  });
});

describe("isValidSlug", () => {
  describe("valid slugs", () => {
    it("should accept a 3-character slug", () => {
      expect(isValidSlug("abc")).toBe(true);
    });

    it("should accept a 30-character slug", () => {
      expect(isValidSlug("a".repeat(30))).toBe(true);
    });

    it("should accept alphanumeric characters", () => {
      expect(isValidSlug("abc123")).toBe(true);
    });

    it("should accept dashes", () => {
      expect(isValidSlug("my-slug")).toBe(true);
    });

    it("should accept underscores", () => {
      expect(isValidSlug("my_slug")).toBe(true);
    });

    it("should accept a mix of alphanumeric, dashes, and underscores", () => {
      expect(isValidSlug("my-slug_123")).toBe(true);
    });

    it("should accept uppercase letters", () => {
      expect(isValidSlug("MySlug")).toBe(true);
    });
  });

  describe("invalid slugs", () => {
    it("should reject a slug shorter than 3 characters", () => {
      expect(isValidSlug("ab")).toBe(false);
    });

    it("should reject a slug longer than 30 characters", () => {
      expect(isValidSlug("a".repeat(31))).toBe(false);
    });

    it("should reject a slug with spaces", () => {
      expect(isValidSlug("my slug")).toBe(false);
    });

    it("should reject a slug with @", () => {
      expect(isValidSlug("my@slug")).toBe(false);
    });

    it("should reject a slug with dots", () => {
      expect(isValidSlug("my.slug")).toBe(false);
    });

    it("should reject a slug with slashes", () => {
      expect(isValidSlug("my/slug")).toBe(false);
    });

    it("should reject an empty string", () => {
      expect(isValidSlug("")).toBe(false);
    });

    it("should reject special characters", () => {
      expect(isValidSlug("slug!")).toBe(false);
    });
  });

  describe("SLUG_REGEX consistency", () => {
    it("should match the regex directly for valid slugs", () => {
      expect(SLUG_REGEX.test("valid-slug_123")).toBe(true);
    });

    it("should not match the regex for invalid slugs", () => {
      expect(SLUG_REGEX.test("invalid slug!")).toBe(false);
    });
  });
});

describe("MAX_ANON_EXPIRY_DAYS", () => {
  it("should be 7 days", () => {
    expect(MAX_ANON_EXPIRY_DAYS).toBe(7);
  });
});

describe("getMaxAnonExpiry", () => {
  it("should return a date approximately 7 days in the future", () => {
    const before = new Date();
    const maxExpiry = getMaxAnonExpiry();
    const after = new Date();

    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + MAX_ANON_EXPIRY_DAYS);

    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + MAX_ANON_EXPIRY_DAYS);

    expect(maxExpiry.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(maxExpiry.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });
});

describe("resolveAnonExpiry", () => {
  describe("when no date is provided", () => {
    it("should return the max expiry date", () => {
      const result = resolveAnonExpiry(null);
      expect(result.date).toBeDefined();
      expect(result.error).toBeUndefined();

      const maxExpiry = getMaxAnonExpiry();
      // The returned date should be close to maxExpiry (within 1 second)
      expect(Math.abs(result.date!.getTime() - maxExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe("when a valid date is provided", () => {
    it("should return the provided date when within limits", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      const result = resolveAnonExpiry(futureDate);
      expect(result.date).toBe(futureDate);
      expect(result.error).toBeUndefined();
    });

    it("should return the provided date exactly at the limit (7 days)", () => {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + MAX_ANON_EXPIRY_DAYS);
      // Subtract 1 second to be safely within the limit
      maxDate.setSeconds(maxDate.getSeconds() - 1);

      const result = resolveAnonExpiry(maxDate);
      expect(result.date).toBe(maxDate);
      expect(result.error).toBeUndefined();
    });
  });

  describe("when the date exceeds the limit", () => {
    it("should return an error for a date beyond 7 days", () => {
      const tooFarDate = new Date();
      tooFarDate.setDate(tooFarDate.getDate() + MAX_ANON_EXPIRY_DAYS + 1);

      const result = resolveAnonExpiry(tooFarDate);
      expect(result.error).toBeDefined();
      expect(result.date).toBeUndefined();
      expect(result.error).toContain(`${MAX_ANON_EXPIRY_DAYS} days`);
    });

    it("should return an error for a date 30 days in the future", () => {
      const farDate = new Date();
      farDate.setDate(farDate.getDate() + 30);

      const result = resolveAnonExpiry(farDate);
      expect(result.error).toBeDefined();
      expect(result.date).toBeUndefined();
    });
  });
});

describe("hashApiKey", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashApiKey("sk_abc123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    expect(hashApiKey("sk_abc123")).toBe(hashApiKey("sk_abc123"));
  });

  it("produces different hashes for different keys", () => {
    expect(hashApiKey("sk_aaa")).not.toBe(hashApiKey("sk_bbb"));
  });
});

describe("generateApiKey", () => {
  it("returns a raw key starting with sk_", () => {
    const { raw } = generateApiKey();
    expect(raw).toMatch(/^sk_[0-9a-f]{32}$/);
  });

  it("returns a hash that is the SHA-256 of the raw key", () => {
    const { raw, hash } = generateApiKey();
    expect(hash).toBe(hashApiKey(raw));
  });

  it("returns a prefix that is the first 11 characters of the raw key", () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.substring(0, 11));
  });

  it("generates unique keys on each call", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.raw).not.toBe(key2.raw);
    expect(key1.hash).not.toBe(key2.hash);
  });
});
