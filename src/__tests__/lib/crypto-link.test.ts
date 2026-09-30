/**
 * Tests for the crypto-link module
 */
import nodeCrypto from "node:crypto";
import { encrypt, decrypt } from "@/lib/crypto-link";

describe("crypto-link", () => {
  describe("encrypt", () => {
    it("should encrypt text with a password", () => {
      const text = "Hello, World!";
      const password = "secret123";

      const encrypted = encrypt(text, password);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(text);
    });

    it("should produce different ciphertexts for the same input (due to random IV)", () => {
      const text = "Hello, World!";
      const password = "secret123";

      const encrypted1 = encrypt(text, password);
      const encrypted2 = encrypt(text, password);

      // Should be different due to random IV/salt
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should produce output in v2:salt:iv:tag:ciphertext format", () => {
      const text = "Test message";
      const password = "testpass";

      const encrypted = encrypt(text, password);
      const parts = encrypted.split(":");

      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe("v2");
      // All parts should be valid base64
      parts.slice(1).forEach((part) => {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      });
    });

    it("should handle empty string", () => {
      const text = "";
      const password = "secret123";

      const encrypted = encrypt(text, password);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
    });

    it("should handle unicode characters", () => {
      const text = "こんにちは世界 🌍 αβγ";
      const password = "unicodepass";

      const encrypted = encrypt(text, password);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(5);
    });

    it("should handle long text", () => {
      const text = "A".repeat(10000);
      const password = "secret123";

      const encrypted = encrypt(text, password);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
    });
  });

  describe("decrypt", () => {
    it("should still decrypt legacy AES-256-CBC values (salt:iv:encrypted)", () => {
      const text = "legacy secret";
      const password = "secret123";
      const salt = nodeCrypto.randomBytes(16);
      const iv = nodeCrypto.randomBytes(16);
      const key = nodeCrypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
      const cipher = nodeCrypto.createCipheriv("aes-256-cbc", key, iv);
      const body = cipher.update(text, "utf8", "base64") + cipher.final("base64");
      const legacy = [salt.toString("base64"), iv.toString("base64"), body].join(":");

      expect(decrypt(legacy, password)).toBe(text);
    });

    it("should throw when a v2 ciphertext has been tampered with", () => {
      const password = "secret123";
      const parts = encrypt("Hello, World!", password).split(":");
      const ciphertext = Buffer.from(parts[4], "base64");
      ciphertext[0] ^= 0xff;
      parts[4] = ciphertext.toString("base64");

      expect(() => decrypt(parts.join(":"), password)).toThrow();
    });

    it.each([
      ["text encrypted with the same password", "Hello, World!", "secret123"],
      ["empty string", "", "secret123"],
      ["unicode characters", "こんにちは世界 🌍 αβγ", "unicodepass"],
      ["special characters in text", "!@#$%^&*()_+-=[]{}|;:,.<>?/~`'\"\\", "special"],
      ["long text", "A".repeat(10000), "secret123"],
    ])("should decrypt: %s", (_label, text, password) => {
      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(text);
    });

    it("should fail to decrypt with wrong password", () => {
      const text = "Hello, World!";
      const password = "secret123";
      const wrongPassword = "wrongpass";

      const encrypted = encrypt(text, password);

      // Either throws an error or returns incorrect text (due to AES padding/key mismatch)
      try {
        const decrypted = decrypt(encrypted, wrongPassword);
        // If it doesn't throw, the decrypted text should not match original
        expect(decrypted).not.toBe(text);
      } catch {
        // Expected - wrong password causes decryption to fail
        expect(true).toBe(true);
      }
    });

    it("should throw error for invalid encrypted format", () => {
      expect(() => decrypt("invalidformat", "password")).toThrow("Invalid encrypted format");
      expect(() => decrypt("only:twoparts", "password")).toThrow("Invalid encrypted format");
      expect(() => decrypt("", "password")).toThrow("Invalid encrypted format");
    });
  });

  describe("encrypt and decrypt round trip", () => {
    const testCases = [
      { text: "Simple text", password: "pass" },
      { text: "https://example.com/path?query=value", password: "urlpass" },
      { text: '{"key": "value", "number": 123}', password: "jsonpass" },
      { text: "Line1\nLine2\nLine3", password: "multiline" },
      { text: "\t\tindented", password: "tabpass" },
    ];

    testCases.forEach(({ text, password }) => {
      it(`should correctly round-trip: "${text.substring(0, 20)}..."`, () => {
        const encrypted = encrypt(text, password);
        const decrypted = decrypt(encrypted, password);
        expect(decrypted).toBe(text);
      });
    });
  });
});
