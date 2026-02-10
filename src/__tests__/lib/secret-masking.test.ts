/**
 * Tests for secret masking module
 */
import {
  maskSecret,
  unmaskSecret,
  isMaskedSecret,
  MASKED_SECRET_SENTINEL,
  clearAllSecretHashes,
} from '@/lib/secret-masking';

describe('Secret masking', () => {
  afterEach(() => {
    clearAllSecretHashes();
  });

  describe('maskSecret', () => {
    it('should mask non-empty secrets', () => {
      const masked = maskSecret('my-secret-password', 'test-field');
      expect(masked).toBe(MASKED_SECRET_SENTINEL);
      expect(masked).not.toBe('my-secret-password');
    });

    it('should return null for null input', () => {
      const masked = maskSecret(null, 'test-field');
      expect(masked).toBeNull();
    });

    it('should return null for empty string', () => {
      const masked = maskSecret('', 'test-field');
      expect(masked).toBeNull();
    });

    it('should return same sentinel for all secrets', () => {
      const masked1 = maskSecret('secret1', 'field1');
      const masked2 = maskSecret('secret2', 'field2');
      expect(masked1).toBe(MASKED_SECRET_SENTINEL);
      expect(masked2).toBe(MASKED_SECRET_SENTINEL);
    });

    it('should store hash internally', () => {
      const original = 'my-secret-key';
      maskSecret(original, 'test-field');
      
      // Mask again with same field name - should still work
      const masked = maskSecret(original, 'test-field');
      expect(masked).toBe(MASKED_SECRET_SENTINEL);
    });
  });

  describe('unmaskSecret', () => {
    it('should return original for non-masked value', () => {
      const result = unmaskSecret('plain-password', 'test-field', null);
      expect(result).toBe('plain-password');
    });

    it('should return stored secret when provided value is masked', () => {
      const original = 'my-secret-key';
      maskSecret(original, 'test-field');
      
      const result = unmaskSecret(MASKED_SECRET_SENTINEL, 'test-field', original);
      expect(result).toBe(original);
    });

    it('should return new secret when value changed', () => {
      const oldSecret = 'old-secret';
      const newSecret = 'new-secret';
      maskSecret(oldSecret, 'test-field');
      
      const result = unmaskSecret(newSecret, 'test-field', oldSecret);
      expect(result).toBe(newSecret);
    });

    it('should handle null stored secret', () => {
      const newSecret = 'new-secret';
      const result = unmaskSecret(newSecret, 'test-field', null);
      expect(result).toBe(newSecret);
    });

    it('should return null when clearing secret', () => {
      maskSecret('old-secret', 'test-field');
      const result = unmaskSecret(null, 'test-field', 'old-secret');
      expect(result).toBeNull();
    });
  });

  describe('isMaskedSecret', () => {
    it('should identify masked sentinel', () => {
      expect(isMaskedSecret(MASKED_SECRET_SENTINEL)).toBe(true);
    });

    it('should return false for non-masked values', () => {
      expect(isMaskedSecret('plain-password')).toBe(false);
      expect(isMaskedSecret(null)).toBe(false);
      expect(isMaskedSecret(undefined)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long secrets', () => {
      const longSecret = 'a'.repeat(1000);
      const masked = maskSecret(longSecret, 'long-field');
      expect(masked).toBe(MASKED_SECRET_SENTINEL);
      
      const result = unmaskSecret(MASKED_SECRET_SENTINEL, 'long-field', longSecret);
      expect(result).toBe(longSecret);
    });

    it('should handle special characters in secrets', () => {
      const specialSecret = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      const masked = maskSecret(specialSecret, 'special-field');
      expect(masked).toBe(MASKED_SECRET_SENTINEL);
      
      const result = unmaskSecret(MASKED_SECRET_SENTINEL, 'special-field', specialSecret);
      expect(result).toBe(specialSecret);
    });

    it('should handle Unicode characters', () => {
      const unicodeSecret = '密码🔐パスワード';
      const masked = maskSecret(unicodeSecret, 'unicode-field');
      expect(masked).toBe(MASKED_SECRET_SENTINEL);
      
      const result = unmaskSecret(MASKED_SECRET_SENTINEL, 'unicode-field', unicodeSecret);
      expect(result).toBe(unicodeSecret);
    });

    it('should handle multiple fields independently', () => {
      const secret1 = 'secret-one';
      const secret2 = 'secret-two';
      
      maskSecret(secret1, 'field1');
      maskSecret(secret2, 'field2');
      
      const result1 = unmaskSecret(MASKED_SECRET_SENTINEL, 'field1', secret1);
      const result2 = unmaskSecret(MASKED_SECRET_SENTINEL, 'field2', secret2);
      
      expect(result1).toBe(secret1);
      expect(result2).toBe(secret2);
    });

    it('should handle clearing and re-setting secrets', () => {
      const original = 'original-secret';
      const newSecret = 'new-secret';
      
      maskSecret(original, 'test-field');
      unmaskSecret(null, 'test-field', original); // Clear
      maskSecret(newSecret, 'test-field');
      
      const result = unmaskSecret(MASKED_SECRET_SENTINEL, 'test-field', newSecret);
      expect(result).toBe(newSecret);
    });
  });
});
