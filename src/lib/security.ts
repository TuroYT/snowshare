import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { MAX_ANON_EXPIRY_DAYS } from "@/lib/share-constants";

export const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export { MAX_ANON_EXPIRY_DAYS };

export function getMaxAnonExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + MAX_ANON_EXPIRY_DAYS);
  return d;
}

/** Defaults a missing expiration to the maximum; returns an error when it is beyond it. */
export function resolveAnonExpiry(
  expiresAt: Date | null
): { date: Date; error?: never } | { date?: never; error: string } {
  const maxExpiry = getMaxAnonExpiry();
  if (!expiresAt) {
    return { date: maxExpiry };
  }
  if (expiresAt > maxExpiry) {
    return { error: `Anonymous shares cannot expire beyond ${MAX_ANON_EXPIRY_DAYS} days` };
  }
  return { date: expiresAt };
}

/** Random slug: 8 bytes as base64url (11 chars). */
export async function generateRandomSlug(
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug: string;
  do {
    slug = crypto.randomBytes(8).toString("base64url");
  } while (await checkExists(slug));
  return slug;
}

/**
 * Hash an API key for storage and lookup: HMAC-SHA256 keyed with NEXTAUTH_SECRET.
 *
 * API keys are 128-bit random tokens, not user-chosen passwords, so a fast deterministic hash
 * is appropriate: it allows an indexed lookup by hash (a salted slow hash such as bcrypt makes
 * lookups impossible and turns every Bearer request into a CPU-bound operation). The server
 * secret additionally prevents checking candidate keys offline against a leaked database.
 * Changing NEXTAUTH_SECRET therefore invalidates every existing API key.
 */
export function hashApiKey(rawKey: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to hash API keys");
  }
  return crypto.createHmac("sha256", secret).update(rawKey).digest("hex");
}

/** `sk_<32 hex chars>`. The raw key is shown once; only its hash is persisted. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `sk_${crypto.randomBytes(16).toString("hex")}`;
  const hash = hashApiKey(raw);
  const prefix = raw.substring(0, 11);
  return { raw, hash, prefix };
}
