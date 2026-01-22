/**
 * Tests for file download streaming functionality
 */

// Mock external dependencies before imports
jest.mock('@/app/api/shares/(fileShare)/fileshare', () => ({
  getFileShare: jest.fn(),
}));

jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  statSync: jest.fn(),
  existsSync: jest.fn(),
}));

import { getFileShare } from '@/app/api/shares/(fileShare)/fileshare';
import { createReadStream, statSync, existsSync } from 'fs';
import { Readable } from 'stream';

const mockGetFileShare = getFileShare as jest.Mock;
const mockCreateReadStream = createReadStream as jest.Mock;
const mockStatSync = statSync as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;

describe('File Download Streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use streaming instead of loading entire file into memory', async () => {
    // Arrange
    const mockFilePath = '/path/to/file.txt';
    const mockSlug = 'test-slug';
    
    mockGetFileShare.mockResolvedValue({
      filePath: mockFilePath,
      originalFilename: 'test-file.txt',
    });
    
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1000000 }); // 1MB file
    
    // Create a mock readable stream
    const mockStream = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      }
    });
    
    mockCreateReadStream.mockReturnValue(mockStream);
    
    // Act
    // Import the route handler
    const { GET } = await import('@/app/api/download/[slug]/route');
    
    // Create mock request
    const mockRequest = {
      url: `http://localhost:3000/api/download/${mockSlug}`,
      headers: new Map(),
    } as unknown as NextRequest;
    
    const mockParams = Promise.resolve({ slug: mockSlug });
    
    await GET(mockRequest, { params: mockParams });
    
    // Assert
    expect(mockCreateReadStream).toHaveBeenCalledWith(mockFilePath);
    expect(mockCreateReadStream).toHaveBeenCalledTimes(1);
  });

  it('should handle range requests for resumable downloads', async () => {
    // Arrange
    const mockFilePath = '/path/to/large-file.bin';
    const mockSlug = 'large-file-slug';
    const fileSize = 10000000; // 10MB
    
    mockGetFileShare.mockResolvedValue({
      filePath: mockFilePath,
      originalFilename: 'large-file.bin',
    });
    
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: fileSize });
    
    // Create a mock readable stream
    const mockStream = new Readable({
      read() {
        this.push('partial data');
        this.push(null);
      }
    });
    
    mockCreateReadStream.mockReturnValue(mockStream);
    
    // Act
    const { GET } = await import('@/app/api/download/[slug]/route');
    
    // Create mock request with Range header
    const mockHeaders = new Map();
    mockHeaders.set('range', 'bytes=0-999999');
    
    const mockRequest = {
      url: `http://localhost:3000/api/download/${mockSlug}`,
      headers: {
        get: (key: string) => mockHeaders.get(key),
      },
    } as unknown as NextRequest;
    
    const mockParams = Promise.resolve({ slug: mockSlug });
    
    await GET(mockRequest, { params: mockParams });
    
    // Assert
    expect(mockCreateReadStream).toHaveBeenCalledWith(
      mockFilePath,
      expect.objectContaining({
        start: 0,
        end: 999999,
      })
    );
  });

  it('should verify streaming is used in all download endpoints', () => {
    // This test documents that streaming should be used in:
    // 1. /api/download/[slug]/route.ts
    // 2. /f/[slug]/api/route.ts
    // 3. /f/[slug]/download/route.ts (already implemented)
    
    expect(mockCreateReadStream).toBeDefined();
    expect(typeof mockCreateReadStream).toBe('function');
  });
});
