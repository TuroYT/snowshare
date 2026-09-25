import bcrypt from "bcryptjs";
import crypto from "crypto";
import { MAX_ANON_EXPIRY_DAYS } from "@/lib/share-constants";

/**
 * Bcrypt cost factor — standardized across the entire application.
 */
export const BCRYPT_COST = 12;

/**
 * Hash a password with the standardized bcrypt cost.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Slug validation regex — alphanumeric, dashes, underscores, 3-30 chars.
 */
export const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * Validate a slug string.
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export { MAX_ANON_EXPIRY_DAYS };

/**
 * Compute the maximum expiry Date for an anonymous user (now + MAX_ANON_EXPIRY_DAYS).
 */
export function getMaxAnonExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + MAX_ANON_EXPIRY_DAYS);
  return d;
}

/**
 * Clamp or default an anonymous user's expiration date.
 * Returns the expiry Date to use, or an error string if the date is too far out.
 */
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

/**
 * Generate a cryptographically secure random slug.
 * Format: 8 random bytes encoded as base64url (11 chars).
 */
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

/**
 * Generate a new raw API key.
 * Format: sk_<32 hex chars>
 * The raw key is shown once and never stored — only its HMAC-SHA256 hash is persisted.
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `sk_${crypto.randomBytes(16).toString("hex")}`;
  const hash = hashApiKey(raw);
  const prefix = raw.substring(0, 11); // "sk_" + 8 chars
  return { raw, hash, prefix };
}
