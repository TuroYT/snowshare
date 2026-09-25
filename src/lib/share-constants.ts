/**
 * Share rules shared by server and client code (no Node.js imports: safe in client bundles).
 */

/** Share password length bounds */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;

/** Maximum expiration, in days, for shares created anonymously */
export const MAX_ANON_EXPIRY_DAYS = 7;

/** Maximum expiration, in days, offered in the share forms to signed-in users */
export const MAX_AUTH_EXPIRY_DAYS = 365;
