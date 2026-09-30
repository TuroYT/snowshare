// Not "node:crypto": this module is reachable from a client bundle through
// src/lib/providers.ts and webpack cannot resolve the "node:" scheme there.
import crypto from "crypto";

const V2_PREFIX = "v2";
const PBKDF2_ITERATIONS = 100_000;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
}

/**
 * Encrypts a text string with a password (AES-256-GCM, authenticated)
 * @param {string} text - Text to encrypt
 * @param {string} password - Password
 * @returns {string} - Encrypted string in the form v2:salt:iv:tag:ciphertext (base64 parts)
 */
export function encrypt(text: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: GCM_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [V2_PREFIX, salt, iv, tag, ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64")))
    .join(":");
}

function decryptV2(parts: string[], password: string): string {
  const [saltBase64, ivBase64, tagBase64, ciphertextBase64] = parts;
  if (!saltBase64 || !ivBase64 || !tagBase64 || ciphertextBase64 === undefined) {
    throw new Error("Invalid encrypted format");
  }
  const key = deriveKey(password, Buffer.from(saltBase64, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"), {
    authTagLength: GCM_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Legacy format (salt:iv:encrypted, AES-256-CBC). Kept for backward compatibility only,
 * to read values already stored in the database. New values are never written with CBC.
 */
function decryptLegacyCbc(parts: string[], password: string): string {
  const [saltBase64, ivBase64, encryptedText] = parts;
  if (!saltBase64 || !ivBase64 || !encryptedText) throw new Error("Invalid encrypted format");
  const key = deriveKey(password, Buffer.from(saltBase64, "base64"));
  const iv = Buffer.from(ivBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Decrypts an encrypted string with a password
 * @param {string} encrypted - v2:salt:iv:tag:ciphertext (AES-256-GCM) or legacy salt:iv:encrypted (AES-256-CBC)
 * @param {string} password - Password
 * @returns {string} - Decrypted text
 */
export function decrypt(encrypted: string, password: string): string {
  const parts = encrypted.split(":");
  if (parts[0] === V2_PREFIX && parts.length === 5) {
    return decryptV2(parts.slice(1), password);
  }
  return decryptLegacyCbc(parts, password);
}
