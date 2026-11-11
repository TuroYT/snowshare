/**
 * @jest-environment node
 */

import {
  base32Decode,
  base32Encode,
  openTotpSecret,
  sealTotpSecret,
  totpAuthUrl,
  totpCode,
  totpCounter,
  verifyTotp,
} from "@/lib/totp";

// RFC 6238 appendix B test secret ("12345678901234567890"), SHA-1, last 6 digits
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from("hello totp");
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, totpCounter(59 * 1000))).toBe("287082");
    expect(totpCode(RFC_SECRET, totpCounter(1111111109 * 1000))).toBe("081804");
    expect(totpCode(RFC_SECRET, totpCounter(2000000000 * 1000))).toBe("279037");
  });

  it("accepts one step of drift and refuses replays", () => {
    const now = 1111111109 * 1000;
    const counter = totpCounter(now);
    const previous = totpCode(RFC_SECRET, counter - 1);
    expect(verifyTotp(RFC_SECRET, previous, { now })).toBe(counter - 1);
    expect(verifyTotp(RFC_SECRET, "081 804", { now })).toBe(counter);
    expect(verifyTotp(RFC_SECRET, "081804", { now, lastCounter: counter })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, counter - 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abc", { now })).toBeNull();
  });

  it("builds an otpauth URL and seals secrets", () => {
    expect(totpAuthUrl("ABC", "a@b.c", "SnowShare")).toBe(
      "otpauth://totp/SnowShare%3Aa%40b.c?secret=ABC&issuer=SnowShare&algorithm=SHA1&digits=6&period=30"
    );
    process.env.NEXTAUTH_SECRET = "test-secret";
    const sealed = sealTotpSecret(RFC_SECRET);
    expect(sealed).not.toContain(RFC_SECRET);
    expect(openTotpSecret(sealed)).toBe(RFC_SECRET);
  });
});
