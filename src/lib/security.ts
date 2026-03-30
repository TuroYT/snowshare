import bcrypt from "bcryptjs";

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

/**
 * Maximum expiry in days for anonymous users.
 */
export const MAX_ANON_EXPIRY_DAYS = 7;

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
