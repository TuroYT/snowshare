/**
 * Tests for paste share functionality
 */

// Mock external dependencies before imports
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    share: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    settings: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn((password) => Promise.resolve(`hashed_${password}`)),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { createPasteShare } from '@/app/api/shares/(pasteShare)/pasteshareshare';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaCreate = prisma.share.create as jest.Mock;
const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockPrismaSettingsFindFirst = prisma.settings.findFirst as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;

describe('createPasteShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated user
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } });
    // Default: slug doesn't exist
    mockPrismaFindUnique.mockResolvedValue(null);
    // Default: successful creation
    mockPrismaCreate.mockResolvedValue({
      id: 'share-456',
      slug: 'paste123',
      type: 'PASTE',
      paste: 'console.log("Hello")',
      pastelanguage: 'JAVASCRIPT',
    });
  });

  describe('paste content validation', () => {
    it('should reject empty paste content', async () => {
      const result = await createPasteShare('', 'javascript');
      expect(result.error).toContain('contenu du paste est requis');
    });

    it('should reject null paste content', async () => {
      const result = await createPasteShare(null as unknown as string, 'javascript');
      expect(result.error).toContain('contenu du paste est requis');
    });

    it('should accept valid paste content', async () => {
      const result = await createPasteShare('console.log("Hello")', 'JAVASCRIPT');
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should accept long paste content', async () => {
      const longContent = 'a'.repeat(10000);
      const result = await createPasteShare(longContent, 'PLAINTEXT');
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should accept code with special characters', async () => {
      const code = `function test() {
        const obj = { key: "value", arr: [1, 2, 3] };
        return obj?.arr?.length ?? 0;
      }`;
      const result = await createPasteShare(code, 'JAVASCRIPT');
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe('language validation', () => {
    it('should reject empty language', async () => {
      const result = await createPasteShare('code', '');
      expect(result.error).toContain('langue du paste est requise');
    });

    it('should reject null language', async () => {
      const result = await createPasteShare('code', null as unknown as string);
      expect(result.error).toContain('langue du paste est requise');
    });

    it('should accept valid language', async () => {
      const result = await createPasteShare('print("Hello")', 'PYTHON');
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should accept various programming languages', async () => {
      const languages = ['JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'PHP', 'GO', 'HTML', 'CSS', 'SQL', 'JSON', 'MARKDOWN', 'PLAINTEXT'];
      
      for (const lang of languages) {
        mockPrismaCreate.mockResolvedValue({
          id: `share-${lang}`,
          slug: `slug-${lang}`,
          type: 'PASTE',
          paste: 'code',
          pastelanguage: lang,
        });
        
        const result = await createPasteShare('code', lang);
        expect(result.error).toBeUndefined();
        expect(result.pasteShare).toBeDefined();
      }
    });
  });

  describe('slug validation', () => {
    it('should reject slug shorter than 3 characters', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, 'ab');
      expect(result.error).toContain('Slug invalide');
    });

    it('should reject slug longer than 30 characters', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, 'a'.repeat(31));
      expect(result.error).toContain('Slug invalide');
    });

    it('should reject slug with special characters', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, 'my@slug');
      expect(result.error).toContain('Slug invalide');
    });

    it('should accept valid slug', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, 'my-paste_123');
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should generate slug if not provided', async () => {
      await createPasteShare('code', 'JAVASCRIPT');
      
      expect(mockPrismaCreate).toHaveBeenCalled();
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.slug).toBeDefined();
    });
  });

  describe('expiration date validation', () => {
    it('should reject expiration date in the past', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await createPasteShare('code', 'JAVASCRIPT', pastDate);
      expect(result.error).toContain('expiration doit être dans le futur');
    });

    it('should accept expiration date in the future', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createPasteShare('code', 'JAVASCRIPT', futureDate);
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe('password validation', () => {
    it('should reject password shorter than 6 characters', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, undefined, 'short');
      expect(result.error).toContain('mot de passe doit contenir entre 6 et 100');
    });

    it('should reject password longer than 100 characters', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, undefined, 'a'.repeat(101));
      expect(result.error).toContain('mot de passe doit contenir entre 6 et 100');
    });

    it('should hash password when provided', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT', undefined, undefined, 'validpassword');
      
      expect(mockBcryptHash).toHaveBeenCalledWith('validpassword', 12);
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should allow paste without password', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT');
      
      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe('anonymous user restrictions', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(null); // Anonymous user
    });

    it('should require expiration date for anonymous users', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT');
      expect(result.error).toContain('utilisateurs non authentifiés doivent fournir une date d\'expiration');
    });

    it('should reject expiration beyond 7 days for anonymous users', async () => {
      const beyondMax = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const result = await createPasteShare('code', 'JAVASCRIPT', beyondMax);
      expect(result.error).toContain('utilisateurs non authentifiés ne peuvent pas créer de partages expirant au-delà de 7 jours');
    });

    it('should allow expiration within 7 days for anonymous users', async () => {
      const withinMax = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const result = await createPasteShare('code', 'JAVASCRIPT', withinMax);
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });
  });

  describe('authenticated user', () => {
    it('should allow creating paste without expiration date', async () => {
      const result = await createPasteShare('code', 'JAVASCRIPT');
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should allow expiration beyond 7 days', async () => {
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const result = await createPasteShare('code', 'JAVASCRIPT', farFuture);
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
    });

    it('should associate paste with user', async () => {
      await createPasteShare('code', 'JAVASCRIPT');
      
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.ownerId).toBe('user-123');
    });
  });

  describe('database operations', () => {
    it('should create paste with correct data', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createPasteShare('console.log("test")', 'JAVASCRIPT', expiresAt, 'my-paste', 'password123');
      
      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PASTE',
          paste: 'console.log("test")',
          pastelanguage: 'JAVASCRIPT',
          slug: 'my-paste',
          ownerId: 'user-123',
        }),
      });
    });

    it('should check for slug uniqueness', async () => {
      // First call returns existing slug, second returns null
      mockPrismaFindUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      
      await createPasteShare('code', 'JAVASCRIPT');
      
      // Should have checked for slug uniqueness
      expect(mockPrismaFindUnique).toHaveBeenCalled();
    });

    it('should store hashed password, not plaintext', async () => {
      await createPasteShare('code', 'JAVASCRIPT', {} as any, undefined, undefined, 'mypassword');
      
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.password).toBe('hashed_mypassword');
      expect(createArgs.data.password).not.toBe('mypassword');
    });
  });

  describe('anonymous user restrictions', () => {
    beforeEach(() => {
      // Set anonymous user (no session)
      mockGetServerSession.mockResolvedValue(null);
    });

    it('should reject anonymous paste share when allowAnonPasteShare is false', async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({
        allowAnonPasteShare: false,
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createPasteShare('console.log("test")', 'JAVASCRIPT', {} as any, futureDate);
      
      expect(result.error).toBe('Anonymous users are not allowed to create paste shares. Please log in.');
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    it('should allow anonymous paste share when allowAnonPasteShare is true', async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({
        allowAnonPasteShare: true,
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createPasteShare('console.log("test")', 'JAVASCRIPT', {} as any, futureDate);
      
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
      expect(mockPrismaCreate).toHaveBeenCalled();
    });

    it('should allow anonymous paste share when settings are null (default behavior)', async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue(null);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createPasteShare('console.log("test")', 'JAVASCRIPT', {} as any, futureDate);
      
      expect(result.error).toBeUndefined();
      expect(result.pasteShare).toBeDefined();
      expect(mockPrismaCreate).toHaveBeenCalled();
    });
  });
});
