// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    share: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

// Mock next-auth
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}))

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { createPasteShare } from '@/app/api/shares/(pasteShare)/pasteshareshare'

describe('PasteShare API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createPasteShare', () => {
    it('should create a markdown paste successfully', async () => {
      const { prisma } = require('@/lib/prisma')
      const { getServerSession } = require('next-auth/next')
      
      // Mock session (unauthenticated user)
      getServerSession.mockResolvedValue(null)
      
      // Mock successful paste creation
      prisma.share.create.mockResolvedValue({
        id: 'test-id',
        slug: 'test-slug',
        paste: '# Hello World\n\nThis is **markdown** content.',
        pastelanguage: 'MARKDOWN',
        type: 'PASTE',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })

      const result = await createPasteShare(
        '# Hello World\n\nThis is **markdown** content.',
        'markdown',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
      )

      expect(result).toHaveProperty('pasteShare')
      expect(result.pasteShare).toHaveProperty('slug', 'test-slug')
      expect(result.pasteShare).toHaveProperty('pastelanguage', 'MARKDOWN')
    })

    it('should validate markdown paste input', async () => {
      const result = await createPasteShare('', 'markdown')
      
      expect(result).toHaveProperty('error')
      expect(result.error).toBe('Le contenu du paste est requis.')
    })

    it('should validate markdown language parameter', async () => {
      const result = await createPasteShare('# Valid content', '')
      
      expect(result).toHaveProperty('error')
      expect(result.error).toBe('La langue du paste est requise.')
    })

    it('should accept markdown as valid language', async () => {
      const { prisma } = require('@/lib/prisma')
      const { getServerSession } = require('next-auth/next')
      
      getServerSession.mockResolvedValue(null)
      prisma.share.create.mockResolvedValue({
        id: 'test-id',
        slug: 'auto-slug',
        paste: '## Test Markdown',
        pastelanguage: 'MARKDOWN',
        type: 'PASTE',
      })

      const result = await createPasteShare(
        '## Test Markdown', 
        'markdown',
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day expiry for unauthenticated user
      )
      
      expect(result).not.toHaveProperty('error')
      expect(result).toHaveProperty('pasteShare')
    })

    it('should handle markdown paste with custom slug', async () => {
      const { prisma } = require('@/lib/prisma')
      const { getServerSession } = require('next-auth/next')
      
      getServerSession.mockResolvedValue(null)
      
      // Mock slug availability check
      prisma.share.findUnique.mockResolvedValue(null)
      
      prisma.share.create.mockResolvedValue({
        id: 'test-id',
        slug: 'my-markdown-doc',
        paste: '# My Document\n\nMarkdown content here.',
        pastelanguage: 'MARKDOWN',
        type: 'PASTE',
      })

      const result = await createPasteShare(
        '# My Document\n\nMarkdown content here.',
        'markdown',
        new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
        'my-markdown-doc'
      )

      expect(result).toHaveProperty('pasteShare')
      expect(result.pasteShare).toHaveProperty('slug', 'my-markdown-doc')
    })

    it('should handle markdown paste with password protection', async () => {
      const { prisma } = require('@/lib/prisma')
      const { getServerSession } = require('next-auth/next')
      const bcrypt = require('bcryptjs')
      
      getServerSession.mockResolvedValue(null)
      bcrypt.hash.mockResolvedValue('hashed-password')
      
      prisma.share.create.mockResolvedValue({
        id: 'test-id',
        slug: 'protected-slug',
        paste: '# Secret Document\n\nThis is protected.',
        pastelanguage: 'MARKDOWN',
        type: 'PASTE',
        password: 'hashed-password',
      })

      const result = await createPasteShare(
        '# Secret Document\n\nThis is protected.',
        'markdown',
        new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
        undefined, // auto slug
        'secret123'
      )

      expect(result).toHaveProperty('pasteShare')
      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12)
    })

    it('should validate expiration date for unauthenticated users', async () => {
      const { getServerSession } = require('next-auth/next')
      
      getServerSession.mockResolvedValue(null)
      
      // Try to create with expiration beyond 7 days
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days
      
      const result = await createPasteShare(
        '# Test',
        'markdown',
        futureDate
      )

      expect(result).toHaveProperty('error')
      expect(result.error).toBe('Les utilisateurs non authentifiés ne peuvent pas créer de partages expirant au-delà de 7 jours.')
    })

    it('should require expiration for unauthenticated users', async () => {
      const { getServerSession } = require('next-auth/next')
      
      getServerSession.mockResolvedValue(null)
      
      const result = await createPasteShare('# Test', 'markdown')

      expect(result).toHaveProperty('error')
      expect(result.error).toBe('Les utilisateurs non authentifiés doivent fournir une date d\'expiration.')
    })
  })
})