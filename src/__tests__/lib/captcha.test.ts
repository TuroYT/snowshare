/**
 * Tests for CAPTCHA validation module
 */
import { validateCaptcha, getPublicCaptchaConfig } from '@/lib/captcha';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    settings: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock security logger
jest.mock('@/lib/security-logger', () => ({
  logCaptchaValidationFailed: jest.fn(),
  logSecurityEvent: jest.fn(),
  SecurityEventType: {},
  SecurityEventSeverity: {},
}));

// Mock captcha-errors
jest.mock('@/lib/captcha-errors', () => ({
  mapProviderErrorCode: jest.fn((code) => code),
  getCaptchaError: jest.fn((code) => ({
    message: `Error: ${code}`,
    userMessage: `User error: ${code}`,
    adminSuggestion: 'Fix it',
  })),
  CaptchaErrorCode: {
    TOKEN_MISSING: 'token-missing',
    INVALID_RESPONSE: 'invalid-input-response',
    TIMEOUT: 'timeout-or-duplicate',
    UNKNOWN_PROVIDER: 'unknown-provider',
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('CAPTCHA validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCaptcha', () => {
    it('should pass validation when CAPTCHA is disabled', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: false,
      });

      const result = await validateCaptcha('any-token');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when CAPTCHA is enabled but no token provided', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'test-site-key',
        captchaSecretKey: 'test-secret-key',
      });

      const result = await validateCaptcha(null);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBeDefined();
    });

    it('should throw when CAPTCHA is enabled but configuration is incomplete', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: null,
        captchaSecretKey: null,
      });

      await expect(validateCaptcha('test-token')).rejects.toThrow(
        'CAPTCHA configuration incomplete'
      );
    });

    it('should validate reCAPTCHA v2 with valid token', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'test-site-key',
        captchaSecretKey: 'test-secret-key',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      const result = await validateCaptcha('valid-token');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should fail reCAPTCHA v2 with invalid token', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'test-site-key',
        captchaSecretKey: 'test-secret-key',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      });

      const result = await validateCaptcha('invalid-token');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBeDefined();
    });

    it('should validate Turnstile with valid token', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'turnstile',
        captchaSiteKey: 'test-site-key',
        captchaSecretKey: 'test-secret-key',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      const result = await validateCaptcha('valid-token');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'test-site-key',
        captchaSecretKey: 'test-secret-key',
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await validateCaptcha('test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail with unknown CAPTCHA provider', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'unknown-provider',
        captchaSiteKey: 'test-site-key',
        captchaSecretKey: 'test-secret-key',
      });

      const result = await validateCaptcha('test-token');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBeDefined();
    });
  });

  describe('getPublicCaptchaConfig', () => {
    it('should return disabled config when CAPTCHA is disabled', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: false,
      });

      const config = await getPublicCaptchaConfig();

      expect(config).toEqual({
        enabled: false,
        provider: null,
        siteKey: null,
      });
    });

    it('should return public config when CAPTCHA is enabled', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue({
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'public-site-key',
        captchaSecretKey: 'secret-key', // Should not be exposed
      });

      const config = await getPublicCaptchaConfig();

      expect(config).toEqual({
        enabled: true,
        provider: 'recaptcha-v2',
        siteKey: 'public-site-key',
      });
      expect(config).not.toHaveProperty('captchaSecretKey');
    });

    it('should handle missing settings', async () => {
      (prisma.settings.findFirst as jest.Mock).mockResolvedValue(null);

      const config = await getPublicCaptchaConfig();

      expect(config).toEqual({
        enabled: false,
        provider: null,
        siteKey: null,
      });
    });
  });
});
