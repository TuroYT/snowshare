import crypto from "crypto";

// ─── Legacy AES-256-CBC (kept for backward-compat with existing OAuth secrets) ───

/**
 * Encrypt with AES-256-CBC. Used for OAuth client secrets stored in the DB.
 * New code should prefer encryptSecret (AES-256-GCM).
 */
export function encrypt(text: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return salt.toString("base64") + ":" + iv.toString("base64") + ":" + encrypted;
}

/**
 * Decrypt an AES-256-CBC ciphertext (salt:iv:ciphertext format).
 */
export function decrypt(encrypted: string, password: string): string {
  const [saltBase64, ivBase64, encryptedText] = encrypted.split(":");
  if (!saltBase64 || !ivBase64 || !encryptedText) throw new Error("Invalid encrypted format");
  const salt = Buffer.from(saltBase64, "base64");
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  const iv = Buffer.from(ivBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── AES-256-GCM (authenticated encryption — preferred for new secrets) ──────

const GCM_PREFIX = "gcm:";

/**
 * Encrypt a secret with AES-256-GCM (authenticated encryption).
 * Output format: "gcm:<salt_b64>:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 */
export function encryptSecret(text: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv) as crypto.CipherGCM;
  let ciphertext = cipher.update(text, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${GCM_PREFIX}${salt.toString("base64")}:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext}`;
}

/**
 * Decrypt a GCM-encrypted secret.
 * Falls back to returning the raw value when the input is not in GCM format,
 * so existing plaintext values in the DB continue to work until they are
 * re-saved (at which point they will be encrypted).
 */
export function decryptSecret(value: string, password: string): string {
  if (!value.startsWith(GCM_PREFIX)) {
    // Not yet encrypted (legacy plaintext value) — return as-is
    return value;
  }
  const parts = value.slice(GCM_PREFIX.length).split(":");
  if (parts.length !== 4) throw new Error("Invalid GCM encrypted format");
  const [saltB64, ivB64, tagB64, ciphertext] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
