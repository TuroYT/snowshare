/** Time-based one-time passwords (RFC 6238: HMAC-SHA1, 6 digits, 30 s steps). */

import crypto from "crypto";
import { decrypt, encrypt } from "@/lib/crypto-link";

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCounter(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

export function totpCode(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Returns the matching time step (current one ±1 for clock drift), or null. Steps at or below
 * `lastCounter` are refused so a code can't be replayed.
 */
export function verifyTotp(
  secret: string,
  code: string,
  { now = Date.now(), lastCounter = null }: { now?: number; lastCounter?: number | null } = {}
): number | null {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const current = totpCounter(now);
  for (const counter of [current - 1, current, current + 1]) {
    if (lastCounter !== null && counter <= lastCounter) continue;
    const expected = Buffer.from(totpCode(secret, counter));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return counter;
  }
  return null;
}

export function totpAuthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params}`;
}

/** Secrets are stored encrypted with NEXTAUTH_SECRET. */
export function sealTotpSecret(secret: string): string {
  return encrypt(secret, process.env.NEXTAUTH_SECRET ?? "");
}

export function openTotpSecret(sealed: string): string {
  return decrypt(sealed, process.env.NEXTAUTH_SECRET ?? "");
}
