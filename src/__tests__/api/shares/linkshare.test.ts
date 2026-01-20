/**
 * Tests for link share functionality
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

jest.mock('@/lib/crypto-link', () => ({
  encrypt: jest.fn((text, password) => `encrypted_${text}_${password}`),
}));

import { createLinkShare } from '@/app/api/shares/(linkShare)/linkshare';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/crypto-link';

const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaCreate = prisma.share.create as jest.Mock;
const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockPrismaSettingsFindFirst = prisma.settings.findFirst as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockEncrypt = encrypt as jest.Mock;

describe('createLinkShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated user
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } });
    // Default: slug doesn't exist
    mockPrismaFindUnique.mockResolvedValue(null);
    // Default: successful creation
    mockPrismaCreate.mockResolvedValue({
      id: 'share-123',
      slug: 'abc123',
      type: 'URL',
      urlOriginal: 'https://example.com',
    });
  });

  describe('URL validation', () => {
    it('should reject empty URL', async () => {
      const result = await createLinkShare('');
      expect(result.error).toBe('URL originale invalide');
    });

    it('should reject invalid URL format', async () => {
      const result = await createLinkShare('not a valid url');
      expect(result.error).toBe('URL originale invalide');
    });

    it('should accept valid http URL', async () => {
      const result = await createLinkShare('http://example.com');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it('should accept valid https URL', async () => {
      const result = await createLinkShare('https://example.com');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it('should accept localhost URL', async () => {
      const result = await createLinkShare('http://localhost:3000');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it('should accept IP address URL', async () => {
      const result = await createLinkShare('http://192.168.1.1:8080/path');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe('slug validation', () => {
    it('should reject slug shorter than 3 characters', async () => {
      const result = await createLinkShare('https://example.com', undefined, 'ab');
      expect(result.error).toContain('Slug invalide');
    });

    it('should reject slug longer than 30 characters', async () => {
      const result = await createLinkShare('https://example.com', undefined, 'a'.repeat(31));
      expect(result.error).toContain('Slug invalide');
    });

    it('should reject slug with special characters', async () => {
      const result = await createLinkShare('https://example.com', undefined, 'my@slug');
      expect(result.error).toContain('Slug invalide');
    });

    it('should accept valid slug with alphanumeric characters', async () => {
      const result = await createLinkShare('https://example.com', undefined, 'my-slug_123');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it('should generate slug if not provided', async () => {
      await createLinkShare('https://example.com');
      
      expect(mockPrismaCreate).toHaveBeenCalled();
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.slug).toBeDefined();
    });
  });

  describe('expiration date validation', () => {
    it('should reject expiration date in the past', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', pastDate);
      expect(result.error).toContain('expiration doit être dans le futur');
    });

    it('should accept expiration date in the future', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', futureDate);
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe('password validation', () => {
    it('should reject password shorter than 6 characters', async () => {
      const result = await createLinkShare('https://example.com', undefined, undefined, 'short');
      expect(result.error).toContain('mot de passe doit contenir entre 6 et 100');
    });

    it('should reject password longer than 100 characters', async () => {
      const result = await createLinkShare('https://example.com', undefined, undefined, 'a'.repeat(101));
      expect(result.error).toContain('mot de passe doit contenir entre 6 et 100');
    });

    it('should hash password and encrypt URL when password is provided', async () => {
      const result = await createLinkShare('https://example.com', undefined, undefined, 'validpassword');
      
      expect(mockBcryptHash).toHaveBeenCalledWith('validpassword', 12);
      expect(mockEncrypt).toHaveBeenCalledWith('https://example.com', 'validpassword');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe('anonymous user restrictions', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(null); // Anonymous user
    });

    it('should require expiration date for anonymous users', async () => {
      const result = await createLinkShare('https://example.com');
      expect(result.error).toContain('utilisateurs non authentifiés doivent fournir une date d\'expiration');
    });

    it('should reject expiration beyond 7 days for anonymous users', async () => {
      const beyondMax = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', beyondMax);
      expect(result.error).toContain('utilisateurs non authentifiés ne peuvent pas créer de partages expirant au-delà de 7 jours');
    });

    it('should allow expiration within 7 days for anonymous users', async () => {
      const withinMax = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', withinMax);
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });
  });

  describe('authenticated user', () => {
    it('should allow creating share without expiration date', async () => {
      const result = await createLinkShare('https://example.com');
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it('should allow expiration beyond 7 days', async () => {
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', farFuture);
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
    });

    it('should associate share with user', async () => {
      await createLinkShare('https://example.com');
      
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.ownerId).toBe('user-123');
    });
  });

  describe('database operations', () => {
    it('should create share with correct data', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createLinkShare('https://example.com', expiresAt, 'my-slug', 'password123');
      
      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'URL',
          slug: 'my-slug',
          ownerId: 'user-123',
        }),
      });
    });

    it('should check for slug uniqueness', async () => {
      // First call returns existing slug, second returns null
      mockPrismaFindUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      
      await createLinkShare('https://example.com');
      
      // Should have checked for slug uniqueness at least twice
      expect(mockPrismaFindUnique).toHaveBeenCalled();
    });
  });

  describe('anonymous user restrictions', () => {
    beforeEach(() => {
      // Set anonymous user (no session)
      mockGetServerSession.mockResolvedValue(null);
    });

    it('should reject anonymous link share when allowAnonLinkShare is false', async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({
        allowAnonLinkShare: false,
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', {} as any, futureDate);
      
      expect(result.error).toBe('Anonymous users are not allowed to create link shares. Please log in.');
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    it('should allow anonymous link share when allowAnonLinkShare is true', async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue({
        allowAnonLinkShare: true,
      });

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', {} as any, futureDate);
      
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
      expect(mockPrismaCreate).toHaveBeenCalled();
    });

    it('should allow anonymous link share when settings are null (default behavior)', async () => {
      mockPrismaSettingsFindFirst.mockResolvedValue(null);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createLinkShare('https://example.com', {} as any, futureDate);
      
      expect(result.error).toBeUndefined();
      expect(result.linkShare).toBeDefined();
      expect(mockPrismaCreate).toHaveBeenCalled();
    });
  });
});
