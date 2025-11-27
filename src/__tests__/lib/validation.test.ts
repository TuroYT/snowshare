/**
 * Tests for the validation module
 */
import {
  isValidUrl,
  isValidSlug,
  isValidPassword,
  isValidExpirationDate,
  isValidAnonExpirationDate,
  isValidPasteContent,
  isValidPasteLanguage,
  validateFilename,
  validateFileSize,
  generateSafeFilename,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  MAX_ANON_EXPIRY_DAYS,
} from '@/lib/validation';

describe('validation', () => {
  describe('isValidUrl', () => {
    it('should accept valid http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://www.example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('http://example.com/path?query=1')).toBe(true);
      expect(isValidUrl('http://example.com:8080')).toBe(true);
    });

    it('should accept valid https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://www.example.com')).toBe(true);
      expect(isValidUrl('https://sub.domain.example.com')).toBe(true);
    });

    it('should accept localhost', () => {
      expect(isValidUrl('http://localhost')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('localhost')).toBe(true);
    });

    it('should accept IP addresses', () => {
      expect(isValidUrl('http://192.168.1.1')).toBe(true);
      expect(isValidUrl('192.168.1.1')).toBe(true);
      expect(isValidUrl('http://127.0.0.1:8080')).toBe(true);
    });

    it('should accept URLs without protocol', () => {
      expect(isValidUrl('example.com')).toBe(true);
      expect(isValidUrl('www.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('   ')).toBe(false);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidUrl(null as unknown as string)).toBe(false);
      expect(isValidUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isValidSlug', () => {
    it('should accept valid slugs', () => {
      expect(isValidSlug('abc')).toBe(true);
      expect(isValidSlug('my-slug')).toBe(true);
      expect(isValidSlug('my_slug')).toBe(true);
      expect(isValidSlug('my-slug-123')).toBe(true);
      expect(isValidSlug('ABC123')).toBe(true);
      expect(isValidSlug('a'.repeat(30))).toBe(true);
    });

    it('should reject slugs that are too short', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('a')).toBe(false);
      expect(isValidSlug('ab')).toBe(false);
    });

    it('should reject slugs that are too long', () => {
      expect(isValidSlug('a'.repeat(31))).toBe(false);
      expect(isValidSlug('a'.repeat(100))).toBe(false);
    });

    it('should reject slugs with invalid characters', () => {
      expect(isValidSlug('my slug')).toBe(false);
      expect(isValidSlug('my.slug')).toBe(false);
      expect(isValidSlug('my@slug')).toBe(false);
      expect(isValidSlug('my/slug')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidSlug(null as unknown as string)).toBe(false);
      expect(isValidSlug(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should accept valid passwords', () => {
      expect(isValidPassword('password123')).toEqual({ valid: true });
      expect(isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toEqual({ valid: true });
      expect(isValidPassword('a'.repeat(PASSWORD_MAX_LENGTH))).toEqual({ valid: true });
    });

    it('should reject passwords that are too short', () => {
      const result = isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1));
      expect(result.valid).toBe(false);
      expect(result.error).toContain(PASSWORD_MIN_LENGTH.toString());
    });

    it('should reject passwords that are too long', () => {
      const result = isValidPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1));
      expect(result.valid).toBe(false);
      expect(result.error).toContain(PASSWORD_MAX_LENGTH.toString());
    });

    it('should reject empty passwords', () => {
      const result = isValidPassword('');
      expect(result.valid).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidPassword(null as unknown as string).valid).toBe(false);
      expect(isValidPassword(undefined as unknown as string).valid).toBe(false);
    });
  });

  describe('isValidExpirationDate', () => {
    it('should accept future dates', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(isValidExpirationDate(tomorrow)).toEqual({ valid: true });
    });

    it('should accept future date strings', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      expect(isValidExpirationDate(tomorrow)).toEqual({ valid: true });
    });

    it('should reject past dates', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = isValidExpirationDate(yesterday);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should reject current date/time', () => {
      // Need to be careful with timing, use a slightly past date
      const now = new Date(Date.now() - 1000);
      const result = isValidExpirationDate(now);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid date strings', () => {
      const result = isValidExpirationDate('invalid date');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date');
    });
  });

  describe('isValidAnonExpirationDate', () => {
    it('should accept dates within the allowed range', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(isValidAnonExpirationDate(tomorrow)).toEqual({ valid: true });
      
      // Just before max days
      const almostMax = new Date(Date.now() + (MAX_ANON_EXPIRY_DAYS - 1) * 24 * 60 * 60 * 1000);
      expect(isValidAnonExpirationDate(almostMax)).toEqual({ valid: true });
    });

    it('should reject dates beyond the allowed range', () => {
      const beyondMax = new Date(Date.now() + (MAX_ANON_EXPIRY_DAYS + 1) * 24 * 60 * 60 * 1000);
      const result = isValidAnonExpirationDate(beyondMax);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(MAX_ANON_EXPIRY_DAYS.toString());
    });

    it('should reject past dates', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = isValidAnonExpirationDate(yesterday);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });
  });

  describe('isValidPasteContent', () => {
    it('should accept valid paste content', () => {
      expect(isValidPasteContent('console.log("Hello")')).toEqual({ valid: true });
      expect(isValidPasteContent('a')).toEqual({ valid: true });
      expect(isValidPasteContent('a'.repeat(10000))).toEqual({ valid: true });
    });

    it('should reject empty content', () => {
      const result = isValidPasteContent('');
      expect(result.valid).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidPasteContent(null as unknown as string).valid).toBe(false);
      expect(isValidPasteContent(undefined as unknown as string).valid).toBe(false);
    });
  });

  describe('isValidPasteLanguage', () => {
    it('should accept valid languages', () => {
      expect(isValidPasteLanguage('javascript')).toEqual({ valid: true });
      expect(isValidPasteLanguage('python')).toEqual({ valid: true });
      expect(isValidPasteLanguage('TYPESCRIPT')).toEqual({ valid: true });
    });

    it('should reject empty language', () => {
      const result = isValidPasteLanguage('');
      expect(result.valid).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidPasteLanguage(null as unknown as string).valid).toBe(false);
      expect(isValidPasteLanguage(undefined as unknown as string).valid).toBe(false);
    });
  });

  describe('validateFilename', () => {
    it('should accept valid filenames', () => {
      expect(validateFilename('document.pdf')).toEqual({ valid: true });
      expect(validateFilename('my-file_v2.txt')).toEqual({ valid: true });
      expect(validateFilename('image.png')).toEqual({ valid: true });
      expect(validateFilename('file')).toEqual({ valid: true });
    });

    it('should reject filenames that are too long', () => {
      const longName = 'a'.repeat(256) + '.txt';
      const result = validateFilename(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject path traversal attempts', () => {
      expect(validateFilename('../../../etc/passwd').valid).toBe(false);
      expect(validateFilename('..\\windows\\system32').valid).toBe(false);
      expect(validateFilename('file/with/path').valid).toBe(false);
      expect(validateFilename('file\\with\\path').valid).toBe(false);
    });

    it('should respect custom max length', () => {
      const result = validateFilename('toolong.txt', 5);
      expect(result.valid).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(validateFilename(null as unknown as string).valid).toBe(false);
      expect(validateFilename(undefined as unknown as string).valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      expect(validateFileSize(1024, maxSize)).toEqual({ valid: true });
      expect(validateFileSize(0, maxSize)).toEqual({ valid: true });
      expect(validateFileSize(maxSize, maxSize)).toEqual({ valid: true });
    });

    it('should reject files exceeding size limit', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const result = validateFileSize(maxSize + 1, maxSize);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should reject negative sizes', () => {
      const result = validateFileSize(-1, 1024);
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric sizes', () => {
      expect(validateFileSize('100' as unknown as number, 1024).valid).toBe(false);
      expect(validateFileSize(null as unknown as number, 1024).valid).toBe(false);
    });
  });

  describe('generateSafeFilename', () => {
    it('should generate safe filenames with extension', () => {
      const result = generateSafeFilename('document.pdf', 'abc123');
      expect(result).toBe('abc123_document.pdf');
    });

    it('should handle files without extension', () => {
      const result = generateSafeFilename('README', 'xyz789');
      expect(result).toBe('xyz789_README');
    });

    it('should sanitize special characters', () => {
      const result = generateSafeFilename('my file (1).txt', 'id123');
      expect(result).toBe('id123_my_file__1_.txt');
      expect(result).not.toContain(' ');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });

    it('should handle unicode characters', () => {
      const result = generateSafeFilename('документ.pdf', 'id456');
      expect(result).toContain('id456_');
      expect(result).toContain('.pdf');
    });

    it('should preserve allowed characters', () => {
      const result = generateSafeFilename('my-file_v2.0.txt', 'id789');
      expect(result).toBe('id789_my-file_v2.0.txt');
    });

    it('should handle multiple dots in filename', () => {
      const result = generateSafeFilename('archive.tar.gz', 'id000');
      expect(result).toBe('id000_archive.tar.gz');
    });
  });
});
