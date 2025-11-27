/**
 * Valid paste language types - must match the pasteType enum in the Prisma schema
 */
export const VALID_PASTE_LANGUAGES = [
  'PLAINTEXT',
  'JAVASCRIPT',
  'TYPESCRIPT',
  'PYTHON',
  'JAVA',
  'PHP',
  'GO',
  'HTML',
  'CSS',
  'SQL',
  'JSON',
  'MARKDOWN',
] as const;

export type PasteLanguage = (typeof VALID_PASTE_LANGUAGES)[number];

/**
 * Validate if a string is a valid paste language
 */
export function isValidPasteLanguage(language: string): language is PasteLanguage {
  return VALID_PASTE_LANGUAGES.includes(language as PasteLanguage);
}

/**
 * Content size limits
 */
export const MAX_PASTE_SIZE = 10000000; // 10MB in bytes
export const MAX_URL_LENGTH = 2048;
export const MAX_EMAIL_LENGTH = 254;

/**
 * Password constraints
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;

/**
 * Email validation regex (RFC 5322 simplified)
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

/**
 * Validate password meets requirements
 */
export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}
