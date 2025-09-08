import crypto from "crypto";

/**
 * Chiffre une chaîne de texte avec un mot de passe (AES-256-CBC)
 * @param {string} text - Texte à chiffrer
 * @param {string} password - Mot de passe
 * @returns {string} - Chaîne chiffrée sous la forme iv:encrypted
 */
export function encrypt(text: string, password: string): string {
    const salt = crypto.randomBytes(16); // 16 bytes salt
    const iv = crypto.randomBytes(16); // 16 bytes IV
    const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256"); // 100,000 iterations, 32 bytes key
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    // Output: salt_base64:iv_base64:encrypted
    return salt.toString("base64") + ":" + iv.toString("base64") + ":" + encrypted;
}

/**
 * Déchiffre une chaîne chiffrée avec un mot de passe (AES-256-CBC)
 * @param {string} encrypted - Chaîne chiffrée sous la forme iv:encrypted
 * @param {string} password - Mot de passe
 * @returns {string} - Texte déchiffré
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
