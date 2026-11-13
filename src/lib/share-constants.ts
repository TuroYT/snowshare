/**
 * Share rules shared by server and client code (no Node.js imports: safe in client bundles).
 */

/** Share password length bounds */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;

/** Maximum expiration, in days, for shares created anonymously */
export const MAX_ANON_EXPIRY_DAYS = 7;

/**
 * Lifetime of a signed download token (src/lib/share-access.ts). Long enough to start large
 * downloads and seek in videos (Range requests reuse the token), short enough to keep
 * "burn after reading" shares meaningful.
 */
export const DOWNLOAD_TOKEN_TTL_SECONDS = 15 * 60;

/** Maximum expiration, in days, offered in the share forms to signed-in users */
export const MAX_AUTH_EXPIRY_DAYS = 365;
