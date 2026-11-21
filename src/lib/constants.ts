import path from "node:path";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/share-constants";

/** Must match the pasteType enum in the Prisma schema. */
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

export function isValidPasteLanguage(language: string): language is PasteLanguage {
  return VALID_PASTE_LANGUAGES.includes(language as PasteLanguage);
}

export const MAX_PASTE_SIZE = 10000000; // 10MB in bytes
export const MAX_URL_LENGTH = 2048;
export const MAX_EMAIL_LENGTH = 254;

export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/share-constants";

/** Simplified on purpose: no backticks or other characters that are dangerous in templates. */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

/** Only http(s) URLs are accepted. */
export function isValidUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "Invalid URL" };
  }

  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: "URL too long" };
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

/** `UPLOAD_DIR`, defaulting to `uploads/` in the project root. */
export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}
