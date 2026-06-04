import path from "path";

/**
 * Valid paste language types - must match the pasteType enum in the Prisma schema
 */
export const VALID_PASTE_LANGUAGES = [
  "PLAINTEXT",
  "JAVASCRIPT",
  "TYPESCRIPT",
  "PYTHON",
  "JAVA",
  "PHP",
  "GO",
  "POWERSHELL",
  "HTML",
  "CSS",
  "SQL",
  "JSON",
  "MARKDOWN",
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
 * Email validation regex (simplified, safer version)
 * Allows alphanumeric, dots, hyphens, underscores, plus signs
 * Does not allow potentially dangerous characters like backticks
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

/**
 * Validate URL format, restrict to safe protocols, and block private/internal
 * addresses to prevent Server-Side Request Forgery (SSRF) attacks.
 */
export function isValidUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "Invalid URL" };
  }

  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: "URL too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
  }

  // Block private/internal addresses (SSRF protection)
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  const privatePatterns = [
    /^localhost$/,
    /^0\.0\.0\.0$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./, // link-local / AWS metadata
    /^::ffff:/i, // IPv4-mapped IPv6 (::ffff:7f00:1 = 127.0.0.1, etc.)
    // IPv6 Unique Local Address (ULA) fc00::/7 — covers fc** and fd** prefixes
    /^fc[0-9a-f]{2}:/i,
    /^fd[0-9a-f]{2}:/i,
    /^::1$/, // IPv6 loopback
    /^fe80:/i, // IPv6 link-local
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      return { valid: false, error: "Private and internal addresses are not allowed" };
    }
  }

  return { valid: true };
}

/**
 * Validate password meets requirements
 */
export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

/**
 * Upload directory path
 * Configurable via UPLOAD_DIR environment variable
 * Defaults to 'uploads' folder in project root
 */
export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}
