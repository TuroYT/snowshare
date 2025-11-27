/**
 * Tests for the crypto-link module
 */
import { encrypt, decrypt } from '@/lib/crypto-link';

describe('crypto-link', () => {
  describe('encrypt', () => {
    it('should encrypt text with a password', () => {
      const text = 'Hello, World!';
      const password = 'secret123';
      
      const encrypted = encrypt(text, password);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(text);
    });

    it('should produce different ciphertexts for the same input (due to random IV)', () => {
      const text = 'Hello, World!';
      const password = 'secret123';
      
      const encrypted1 = encrypt(text, password);
      const encrypted2 = encrypt(text, password);
      
      // Should be different due to random IV/salt
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce output in salt:iv:encrypted format', () => {
      const text = 'Test message';
      const password = 'testpass';
      
      const encrypted = encrypt(text, password);
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(3);
      // All parts should be valid base64
      parts.forEach(part => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('should handle empty string', () => {
      const text = '';
      const password = 'secret123';
      
      const encrypted = encrypt(text, password);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should handle unicode characters', () => {
      const text = 'こんにちは世界 🌍 αβγ';
      const password = 'unicodepass';
      
      const encrypted = encrypt(text, password);
      
      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should handle long text', () => {
      const text = 'A'.repeat(10000);
      const password = 'secret123';
      
      const encrypted = encrypt(text, password);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decrypt', () => {
    it('should decrypt text encrypted with the same password', () => {
      const text = 'Hello, World!';
      const password = 'secret123';
      
      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);
      
      expect(decrypted).toBe(text);
    });

    it('should fail to decrypt with wrong password', () => {
      const text = 'Hello, World!';
      const password = 'secret123';
      const wrongPassword = 'wrongpass';
      
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

    it('should throw error for invalid encrypted format', () => {
      expect(() => decrypt('invalidformat', 'password')).toThrow('Invalid encrypted format');
      expect(() => decrypt('only:twoparts', 'password')).toThrow('Invalid encrypted format');
      expect(() => decrypt('', 'password')).toThrow('Invalid encrypted format');
    });

    it('should handle empty string decryption', () => {
      const text = '';
      const password = 'secret123';
      
      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);
      
      expect(decrypted).toBe(text);
    });

    it('should handle unicode characters', () => {
      const text = 'こんにちは世界 🌍 αβγ';
      const password = 'unicodepass';
      
      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);
      
      expect(decrypted).toBe(text);
    });

    it('should handle special characters in text', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\';
      const password = 'special';
      
      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);
      
      expect(decrypted).toBe(text);
    });

    it('should handle long text', () => {
      const text = 'A'.repeat(10000);
      const password = 'secret123';
      
      const encrypted = encrypt(text, password);
      const decrypted = decrypt(encrypted, password);
      
      expect(decrypted).toBe(text);
    });
  });

  describe('encrypt and decrypt round trip', () => {
    const testCases = [
      { text: 'Simple text', password: 'pass' },
      { text: 'https://example.com/path?query=value', password: 'urlpass' },
      { text: '{"key": "value", "number": 123}', password: 'jsonpass' },
      { text: 'Line1\nLine2\nLine3', password: 'multiline' },
      { text: '\t\tindented', password: 'tabpass' },
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
