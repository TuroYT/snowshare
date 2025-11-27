/**
 * Tests for file share functionality
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
      update: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn((password) => Promise.resolve(`hashed_${password}`)),
  compare: jest.fn((password, hash) => Promise.resolve(password === hash.replace('hashed_', ''))),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}));

import { createFileShare, getFileShare } from '@/app/api/shares/(fileShare)/fileshare';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';

const mockGetServerSession = getServerSession as jest.Mock;
const mockPrismaCreate = prisma.share.create as jest.Mock;
const mockPrismaFindUnique = prisma.share.findUnique as jest.Mock;
const mockPrismaUpdate = prisma.share.update as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;
const mockWriteFile = writeFile as jest.Mock;
const mockMkdir = mkdir as jest.Mock;

// Helper to create mock File with arrayBuffer method
function createMockFile(name: string, size: number, type = 'text/plain'): File {
  const content = new Array(size).fill('a').join('');
  const file = new File([content], name, { type });
  
  // Add arrayBuffer method that returns a proper ArrayBuffer
  (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => {
    // Create an ArrayBuffer with the content
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < size; i++) {
      view[i] = 97; // 'a' character
    }
    return buffer;
  };
  
  return file;
}

describe('createFileShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated user
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } });
    // Default: slug doesn't exist
    mockPrismaFindUnique.mockResolvedValue(null);
    // Default: uploads directory exists
    mockExistsSync.mockReturnValue(true);
    // Default: successful file write
    mockWriteFile.mockResolvedValue(undefined);
    // Default: successful creation
    mockPrismaCreate.mockResolvedValue({
      id: 'share-789',
      slug: 'file123',
      type: 'FILE',
      filePath: null,
    });
    // Default: successful update
    mockPrismaUpdate.mockResolvedValue({
      id: 'share-789',
      slug: 'file123',
      type: 'FILE',
      filePath: 'share-789_document.pdf',
    });
  });

  describe('file validation', () => {
    it('should reject files with path traversal in name', async () => {
      const maliciousFile = createMockFile('../../../etc/passwd', 100);
      const result = await createFileShare(maliciousFile);
      expect(result.error).toContain('Nom de fichier invalide');
    });

    it('should reject files with backslash in name', async () => {
      const maliciousFile = createMockFile('..\\windows\\system32', 100);
      const result = await createFileShare(maliciousFile);
      expect(result.error).toContain('Nom de fichier invalide');
    });

    it('should reject files with forward slash in name', async () => {
      const maliciousFile = createMockFile('path/to/file.txt', 100);
      const result = await createFileShare(maliciousFile);
      expect(result.error).toContain('Nom de fichier invalide');
    });

    it('should reject files with names longer than 255 characters', async () => {
      const longName = 'a'.repeat(256) + '.txt';
      const file = createMockFile(longName, 100);
      const result = await createFileShare(file);
      expect(result.error).toContain('nom du fichier est trop long');
    });

    it('should accept valid file', async () => {
      const file = createMockFile('document.pdf', 1024);
      const result = await createFileShare(file);
      expect(result.error).toBeUndefined();
      expect(result.fileShare).toBeDefined();
    });

    it('should accept files with various extensions', async () => {
      const files = [
        createMockFile('document.pdf', 100),
        createMockFile('image.png', 100),
        createMockFile('video.mp4', 100),
        createMockFile('archive.zip', 100),
        createMockFile('README', 100),
      ];

      for (const file of files) {
        mockPrismaCreate.mockResolvedValue({
          id: `share-${file.name}`,
          slug: `slug-${file.name}`,
          type: 'FILE',
          filePath: null,
        });
        mockPrismaUpdate.mockResolvedValue({
          id: `share-${file.name}`,
          slug: `slug-${file.name}`,
          type: 'FILE',
          filePath: `share-${file.name}_${file.name}`,
        });

        const result = await createFileShare(file);
        expect(result.error).toBeUndefined();
        expect(result.fileShare).toBeDefined();
      }
    });
  });

  describe('slug validation', () => {
    it('should reject slug shorter than 3 characters', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, 'ab');
      expect(result.error).toContain('Slug invalide');
    });

    it('should reject slug longer than 30 characters', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, 'a'.repeat(31));
      expect(result.error).toContain('Slug invalide');
    });

    it('should reject slug with special characters', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, 'my@slug');
      expect(result.error).toContain('Slug invalide');
    });

    it('should accept valid slug', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, 'my-file_123');
      expect(result.error).toBeUndefined();
      expect(result.fileShare).toBeDefined();
    });

    it('should generate slug if not provided', async () => {
      const file = createMockFile('test.txt', 100);
      await createFileShare(file);
      
      expect(mockPrismaCreate).toHaveBeenCalled();
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.slug).toBeDefined();
    });
  });

  describe('expiration date validation', () => {
    it('should reject expiration date in the past', async () => {
      const file = createMockFile('test.txt', 100);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await createFileShare(file, pastDate);
      expect(result.error).toContain('expiration doit être dans le futur');
    });

    it('should accept expiration date in the future', async () => {
      const file = createMockFile('test.txt', 100);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const result = await createFileShare(file, futureDate);
      expect(result.error).toBeUndefined();
      expect(result.fileShare).toBeDefined();
    });
  });

  describe('password validation', () => {
    it('should reject password shorter than 6 characters', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, undefined, 'short');
      expect(result.error).toContain('mot de passe doit contenir entre 6 et 100');
    });

    it('should reject password longer than 100 characters', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, undefined, 'a'.repeat(101));
      expect(result.error).toContain('mot de passe doit contenir entre 6 et 100');
    });

    it('should hash password when provided', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file, undefined, undefined, 'validpassword');
      
      expect(mockBcryptHash).toHaveBeenCalledWith('validpassword', 12);
      expect(result.error).toBeUndefined();
      expect(result.fileShare).toBeDefined();
    });
  });

  describe('anonymous user restrictions', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(null); // Anonymous user
    });

    it('should reject file for anonymous users (file size 0 limit)', async () => {
      const file = createMockFile('test.txt', 100);
      const withinMax = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const result = await createFileShare(file, withinMax);
      // Anonymous users have MAX_FILE_SIZE_ANON = 0, so any file is rejected first
      expect(result.error).toContain('taille du fichier dépasse');
    });

    it('should check file size before expiration for anonymous users', async () => {
      const file = createMockFile('test.txt', 100);
      // Even with no expiration, file size error comes first
      const result = await createFileShare(file);
      expect(result.error).toContain('taille du fichier dépasse');
    });

    it('should check file size before expiration date limit for anonymous users', async () => {
      const file = createMockFile('test.txt', 100);
      const beyondMax = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const result = await createFileShare(file, beyondMax);
      // File size error comes first before expiration check
      expect(result.error).toContain('taille du fichier dépasse');
    });
  });

  describe('authenticated user', () => {
    it('should allow creating file share without expiration date', async () => {
      const file = createMockFile('test.txt', 100);
      const result = await createFileShare(file);
      expect(result.error).toBeUndefined();
      expect(result.fileShare).toBeDefined();
    });

    it('should allow expiration beyond 7 days', async () => {
      const file = createMockFile('test.txt', 100);
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const result = await createFileShare(file, farFuture);
      expect(result.error).toBeUndefined();
      expect(result.fileShare).toBeDefined();
    });

    it('should associate file share with user', async () => {
      const file = createMockFile('test.txt', 100);
      await createFileShare(file);
      
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.ownerId).toBe('user-123');
    });
  });

  describe('file system operations', () => {
    it('should create uploads directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const file = createMockFile('test.txt', 100);
      await createFileShare(file);
      
      expect(mockMkdir).toHaveBeenCalled();
    });

    it('should not create uploads directory if it exists', async () => {
      mockExistsSync.mockReturnValue(true);
      const file = createMockFile('test.txt', 100);
      await createFileShare(file);
      
      expect(mockMkdir).not.toHaveBeenCalled();
    });

    it('should write file to uploads directory', async () => {
      const file = createMockFile('document.pdf', 1024);
      await createFileShare(file);
      
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should update share with file path after saving', async () => {
      const file = createMockFile('test.txt', 100);
      await createFileShare(file);
      
      expect(mockPrismaUpdate).toHaveBeenCalled();
      const updateArgs = mockPrismaUpdate.mock.calls[0][0];
      expect(updateArgs.data.filePath).toBeDefined();
    });
  });

  describe('database operations', () => {
    it('should create file share with correct data', async () => {
      const file = createMockFile('document.pdf', 1024);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createFileShare(file, expiresAt, 'my-file', 'password123');
      
      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'FILE',
          slug: 'my-file',
          ownerId: 'user-123',
        }),
      });
    });

    it('should check for slug uniqueness', async () => {
      const file = createMockFile('test.txt', 100);
      // First call returns existing slug, second returns null
      mockPrismaFindUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      
      await createFileShare(file);
      
      expect(mockPrismaFindUnique).toHaveBeenCalled();
    });

    it('should store hashed password, not plaintext', async () => {
      const file = createMockFile('test.txt', 100);
      await createFileShare(file, undefined, undefined, 'mypassword');
      
      const createArgs = mockPrismaCreate.mock.calls[0][0];
      expect(createArgs.data.password).toBe('hashed_mypassword');
      expect(createArgs.data.password).not.toBe('mypassword');
    });
  });
});

describe('getFileShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  describe('share retrieval', () => {
    it('should return error for non-existent share', async () => {
      mockPrismaFindUnique.mockResolvedValue(null);
      
      const result = await getFileShare('non-existent');
      expect(result.error).toContain('introuvable');
    });

    it('should return error for non-FILE share type', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'URL', // Not a FILE type
      });
      
      const result = await getFileShare('my-share');
      expect(result.error).toContain('introuvable');
    });

    it('should return error for expired share', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        filePath: 'file.txt',
      });
      
      const result = await getFileShare('my-share');
      expect(result.error).toContain('expiré');
    });
  });

  describe('password protection', () => {
    it('should require password for protected shares', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        password: 'hashed_password',
        filePath: 'file.txt',
      });
      
      const result = await getFileShare('my-share');
      expect(result.error).toContain('Mot de passe requis');
      expect(result.requiresPassword).toBe(true);
    });

    it('should reject incorrect password', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        password: 'hashed_correct',
        filePath: 'file.txt',
      });
      mockBcryptCompare.mockResolvedValue(false);
      
      const result = await getFileShare('my-share', 'wrong');
      expect(result.error).toContain('Mot de passe incorrect');
    });

    it('should accept correct password', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        password: 'hashed_correct',
        filePath: 'file.txt',
        expiresAt: null,
      });
      mockBcryptCompare.mockResolvedValue(true);
      
      const result = await getFileShare('my-share', 'correct');
      expect(result.error).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });

  describe('file existence', () => {
    it('should return error if filePath is null', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        filePath: null,
        expiresAt: null,
      });
      
      const result = await getFileShare('my-share');
      expect(result.error).toContain('Fichier introuvable');
    });

    it('should return error if physical file does not exist', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        filePath: 'missing-file.txt',
        expiresAt: null,
      });
      mockExistsSync.mockReturnValue(false);
      
      const result = await getFileShare('my-share');
      expect(result.error).toContain('physique introuvable');
    });
  });

  describe('successful retrieval', () => {
    it('should return share data and file path', async () => {
      const share = {
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        filePath: 'share-123_document.pdf',
        expiresAt: null,
      };
      mockPrismaFindUnique.mockResolvedValue(share);
      mockExistsSync.mockReturnValue(true);
      
      const result = await getFileShare('my-share');
      expect(result.error).toBeUndefined();
      expect(result.share).toEqual(share);
      expect(result.filePath).toContain('uploads');
      expect(result.originalFilename).toBe('document.pdf');
    });

    it('should return share for non-expired share', async () => {
      mockPrismaFindUnique.mockResolvedValue({
        id: 'share-123',
        slug: 'my-share',
        type: 'FILE',
        filePath: 'share-123_test.txt',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Not expired
      });
      mockExistsSync.mockReturnValue(true);
      
      const result = await getFileShare('my-share');
      expect(result.error).toBeUndefined();
      expect(result.share).toBeDefined();
    });
  });
});
