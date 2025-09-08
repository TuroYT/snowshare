import crypto from "crypto";

/**
 * Chiffre une chaîne de texte avec un mot de passe (AES-256-CBC)
 * @param {string} text - Texte à chiffrer
 * @param {string} password - Mot de passe
 * @returns {string} - Chaîne chiffrée sous la forme iv:encrypted
 */
export function encrypt(text: string, password: string): string {
    const key = crypto.createHash("sha256").update(password).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return iv.toString("base64") + ":" + encrypted;
}

/**
 * Déchiffre une chaîne chiffrée avec un mot de passe (AES-256-CBC)
 * @param {string} encrypted - Chaîne chiffrée sous la forme iv:encrypted
 * @param {string} password - Mot de passe
 * @returns {string} - Texte déchiffré
 */
export function decrypt(encrypted: string, password: string): string {
    const [ivBase64, encryptedText] = encrypted.split(":");
    const key = crypto.createHash("sha256").update(password).digest();
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
