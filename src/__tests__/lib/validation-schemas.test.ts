/**
 * Tests for Zod validation schemas
 */
import {
  registerSchema,
  securitySettingsSchema,
  testCaptchaSchema,
  smtpConfigSchema,
  captchaConfigSchema,
} from '@/lib/validation-schemas';

describe('Validation schemas', () => {
  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'SecurePassword123',
        captchaToken: 'valid-token',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'SecurePassword123',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const data = {
        email: 'test@example.com',
        password: '12345',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should allow optional captchaToken', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePassword123',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('securitySettingsSchema', () => {
    it('should validate complete security settings', () => {
      const validData = {
        requireEmailVerification: true,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'user@gmail.com',
        smtpPassword: 'app-password',
        smtpFromEmail: 'noreply@example.com',
        smtpFromName: 'SnowShare',
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'site-key',
        captchaSecretKey: 'secret-key',
      };

      const result = securitySettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require SMTP config when email verification enabled', () => {
      const data = {
        requireEmailVerification: true,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUser: null,
        smtpPassword: null,
        smtpFromEmail: null,
        smtpFromName: null,
        captchaEnabled: false,
        captchaProvider: null,
        captchaSiteKey: null,
        captchaSecretKey: null,
      };

      const result = securitySettingsSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should require CAPTCHA config when enabled', () => {
      const data = {
        requireEmailVerification: false,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUser: null,
        smtpPassword: null,
        smtpFromEmail: null,
        smtpFromName: null,
        captchaEnabled: true,
        captchaProvider: null,
        captchaSiteKey: null,
        captchaSecretKey: null,
      };

      const result = securitySettingsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should allow minimal config when features disabled', () => {
      const data = {
        requireEmailVerification: false,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUser: null,
        smtpPassword: null,
        smtpFromEmail: null,
        smtpFromName: null,
        captchaEnabled: false,
        captchaProvider: null,
        captchaSiteKey: null,
        captchaSecretKey: null,
      };

      const result = securitySettingsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate SMTP port range', () => {
      const data = {
        requireEmailVerification: true,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 70000,
        smtpSecure: false,
        smtpUser: 'user@gmail.com',
        smtpPassword: 'password',
        smtpFromEmail: 'test@example.com',
        smtpFromName: null,
        captchaEnabled: false,
        captchaProvider: null,
        captchaSiteKey: null,
        captchaSecretKey: null,
      };

      const result = securitySettingsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('testCaptchaSchema', () => {
    it('should validate correct test CAPTCHA data', () => {
      const validData = {
        provider: 'recaptcha-v2',
        siteKey: 'test-site-key',
        secretKey: 'test-secret-key',
      };

      const result = testCaptchaSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider', () => {
      const data = {
        provider: 'invalid-provider',
        siteKey: 'test-site-key',
        secretKey: 'test-secret-key',
      };

      const result = testCaptchaSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should require all fields', () => {
      const data = {
        provider: 'turnstile',
      };

      const result = testCaptchaSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should validate all supported providers', () => {
      const providers = ['recaptcha-v2', 'recaptcha-v3', 'turnstile'];
      
      providers.forEach(provider => {
        const data = {
          provider,
          siteKey: 'test-key',
          secretKey: 'test-secret',
        };
        
        const result = testCaptchaSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('smtpConfigSchema', () => {
    it('should validate complete SMTP config', () => {
      const validData = {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'user@gmail.com',
        smtpPassword: 'app-password',
        smtpFromEmail: 'noreply@example.com',
        smtpFromName: 'SnowShare',
      };

      const result = smtpConfigSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow null values', () => {
      const data = {
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUser: null,
        smtpPassword: null,
        smtpFromEmail: null,
        smtpFromName: null,
      };

      const result = smtpConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate common SMTP ports', () => {
      const validPorts = [25, 465, 587, 2525];
      
      validPorts.forEach(port => {
        const data = {
          smtpHost: 'smtp.example.com',
          smtpPort: port,
          smtpSecure: false,
          smtpUser: 'user@example.com',
          smtpPassword: 'password',
          smtpFromEmail: 'from@example.com',
          smtpFromName: null,
        };
        
        const result = smtpConfigSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid SMTP port', () => {
      const data = {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 70000,
        smtpSecure: false,
        smtpUser: 'user@gmail.com',
        smtpPassword: 'password',
        smtpFromEmail: null,
        smtpFromName: null,
      };

      const result = smtpConfigSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('captchaConfigSchema', () => {
    it('should validate complete CAPTCHA config', () => {
      const validData = {
        captchaEnabled: true,
        captchaProvider: 'recaptcha-v2',
        captchaSiteKey: 'public-site-key',
        captchaSecretKey: 'private-secret-key',
      };

      const result = captchaConfigSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow null values when disabled', () => {
      const data = {
        captchaEnabled: false,
        captchaProvider: null,
        captchaSiteKey: null,
        captchaSecretKey: null,
      };

      const result = captchaConfigSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate all providers', () => {
      const providers = ['recaptcha-v2', 'recaptcha-v3', 'turnstile'];
      
      providers.forEach(provider => {
        const data = {
          captchaEnabled: true,
          captchaProvider: provider,
          captchaSiteKey: 'valid-site-key-string',
          captchaSecretKey: 'valid-secret-key-string',
        };
        
        const result = captchaConfigSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid provider', () => {
      const data = {
        captchaEnabled: true,
        captchaProvider: 'invalid-provider',
        captchaSiteKey: 'site-key',
        captchaSecretKey: 'secret-key',
      };

      const result = captchaConfigSchema.safeParse(data as any);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const data = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject excessively long inputs', () => {
      const data = {
        email: 'a'.repeat(300) + '@example.com',
        password: 'a'.repeat(300),
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should validate email format strictly', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
      ];

      invalidEmails.forEach(email => {
        const data = { email, password: 'ValidPassword123' };
        const result = registerSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });
});
