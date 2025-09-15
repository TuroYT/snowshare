import { createFileShare, getFileShare } from '@/app/api/shares/(fileShare)/fileshare';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    share: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('next-auth/next');
jest.mock('bcryptjs');
jest.mock('fs/promises');
jest.mock('fs');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('FileShare API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFileShare', () => {
    const mockFile = {
      name: 'test.txt',
      size: 1024,
      type: 'text/plain',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
    } as unknown as File;

    it('creates file share for authenticated user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as any);

      mockPrisma.share.findUnique.mockResolvedValue(null);
      mockPrisma.share.create.mockResolvedValue({
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: null,
        ownerId: 'user-123',
        createdAt: new Date(),
        expiresAt: null,
        password: null,
      } as any);

      mockPrisma.share.update.mockResolvedValue({
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        ownerId: 'user-123',
        createdAt: new Date(),
        expiresAt: null,
        password: null,
      } as any);

      const result = await createFileShare(mockFile);

      expect(result.fileShare).toBeDefined();
      expect(result.fileShare?.slug).toBe('test-slug');
      expect(mockPrisma.share.create).toHaveBeenCalledWith({
        data: {
          type: 'FILE',
          slug: expect.any(String),
          password: null,
          expiresAt: undefined,
          ownerId: 'user-123',
          filePath: null,
        },
      });
    });

    it('creates file share for anonymous user with expiration', async () => {
      mockGetServerSession.mockResolvedValue(null);
      
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

      mockPrisma.share.findUnique.mockResolvedValue(null);
      mockPrisma.share.create.mockResolvedValue({
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: null,
        ownerId: null,
        createdAt: new Date(),
        expiresAt,
        password: null,
      } as any);

      mockPrisma.share.update.mockResolvedValue({
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        ownerId: null,
        createdAt: new Date(),
        expiresAt,
        password: null,
      } as any);

      const result = await createFileShare(mockFile, expiresAt);

      expect(result.fileShare).toBeDefined();
      expect(mockPrisma.share.create).toHaveBeenCalledWith({
        data: {
          type: 'FILE',
          slug: expect.any(String),
          password: null,
          expiresAt,
          ownerId: null,
          filePath: null,
        },
      });
    });

    it('validates file size for anonymous users', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const largeFile = {
        name: 'large.txt',
        size: 51 * 1024 * 1024, // 51MB
        type: 'text/plain',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(51 * 1024 * 1024)),
      } as unknown as File;

      const result = await createFileShare(largeFile, new Date(Date.now() + 24 * 60 * 60 * 1000));

      expect(result.error).toContain('La taille du fichier dépasse la limite');
    });

    it('validates file size for authenticated users', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as any);

      const largeFile = {
        name: 'large.txt',
        size: 501 * 1024 * 1024, // 501MB
        type: 'text/plain',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(501 * 1024 * 1024)),
      } as unknown as File;

      const result = await createFileShare(largeFile);

      expect(result.error).toContain('La taille du fichier dépasse la limite');
    });

    it('validates slug format', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as any);

      const result = await createFileShare(mockFile, undefined, 'invalid slug!');

      expect(result.error).toContain('Slug invalide');
    });

    it('validates password length', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as any);

      const result = await createFileShare(mockFile, undefined, undefined, '12345'); // Too short

      expect(result.error).toContain('Le mot de passe doit contenir entre 6 et 100 caractères');
    });

    it('requires expiration for anonymous users', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await createFileShare(mockFile);

      expect(result.error).toContain('Les utilisateurs non authentifiés doivent fournir une date d\'expiration');
    });

    it('limits expiration period for anonymous users', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const farFutureDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now

      const result = await createFileShare(mockFile, farFutureDate);

      expect(result.error).toContain('Les utilisateurs non authentifiés ne peuvent pas créer de partages expirant au-delà de 7 jours');
    });

    it('hashes password when provided', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as any);

      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);

      mockPrisma.share.findUnique.mockResolvedValue(null);
      mockPrisma.share.create.mockResolvedValue({
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: null,
        ownerId: 'user-123',
        createdAt: new Date(),
        expiresAt: null,
        password: 'hashed-password',
      } as any);

      mockPrisma.share.update.mockResolvedValue({
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        ownerId: 'user-123',
        createdAt: new Date(),
        expiresAt: null,
        password: 'hashed-password',
      } as any);

      const result = await createFileShare(mockFile, undefined, undefined, 'testpassword');

      expect(mockBcrypt.hash).toHaveBeenCalledWith('testpassword', 12);
      expect(mockPrisma.share.create).toHaveBeenCalledWith({
        data: {
          type: 'FILE',
          slug: expect.any(String),
          password: 'hashed-password',
          expiresAt: undefined,
          ownerId: 'user-123',
          filePath: null,
        },
      });
    });
  });

  describe('getFileShare', () => {
    it('retrieves file share without password', async () => {
      const mockShare = {
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        password: null,
        expiresAt: null,
        createdAt: new Date(),
        ownerId: 'user-123',
      };

      mockPrisma.share.findUnique.mockResolvedValue(mockShare as any);

      const result = await getFileShare('test-slug');

      expect(result.share).toEqual(mockShare);
      expect(result.filePath).toContain('test.txt');
      expect(result.originalFilename).toBe('test.txt');
    });

    it('requires password for protected shares', async () => {
      const mockShare = {
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        password: 'hashed-password',
        expiresAt: null,
        createdAt: new Date(),
        ownerId: 'user-123',
      };

      mockPrisma.share.findUnique.mockResolvedValue(mockShare as any);

      const result = await getFileShare('test-slug');

      expect(result.error).toContain('Mot de passe requis');
      expect(result.requiresPassword).toBe(true);
    });

    it('validates password for protected shares', async () => {
      const mockShare = {
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        password: 'hashed-password',
        expiresAt: null,
        createdAt: new Date(),
        ownerId: 'user-123',
      };

      mockPrisma.share.findUnique.mockResolvedValue(mockShare as any);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await getFileShare('test-slug', 'correctpassword');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('correctpassword', 'hashed-password');
      expect(result.share).toEqual(mockShare);
    });

    it('rejects incorrect password', async () => {
      const mockShare = {
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        password: 'hashed-password',
        expiresAt: null,
        createdAt: new Date(),
        ownerId: 'user-123',
      };

      mockPrisma.share.findUnique.mockResolvedValue(mockShare as any);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await getFileShare('test-slug', 'wrongpassword');

      expect(result.error).toContain('Mot de passe incorrect');
    });

    it('checks expiration date', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const mockShare = {
        id: 'share-123',
        slug: 'test-slug',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        password: null,
        expiresAt: expiredDate,
        createdAt: new Date(),
        ownerId: 'user-123',
      };

      mockPrisma.share.findUnique.mockResolvedValue(mockShare as any);

      const result = await getFileShare('test-slug');

      expect(result.error).toContain('Ce partage a expiré');
    });

    it('returns error for non-existent share', async () => {
      mockPrisma.share.findUnique.mockResolvedValue(null);

      const result = await getFileShare('non-existent');

      expect(result.error).toContain('Partage de fichier introuvable');
    });

    it('returns error for non-FILE type share', async () => {
      const mockShare = {
        id: 'share-123',
        slug: 'test-slug',
        type: 'URL',
        filePath: null,
        password: null,
        expiresAt: null,
        createdAt: new Date(),
        ownerId: 'user-123',
      };

      mockPrisma.share.findUnique.mockResolvedValue(mockShare as any);

      const result = await getFileShare('test-slug');

      expect(result.error).toContain('Partage de fichier introuvable');
    });
  });
});