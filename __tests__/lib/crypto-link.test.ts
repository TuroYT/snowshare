import { encrypt, decrypt } from '@/lib/crypto-link'

describe('crypto-link utilities', () => {
  const testPassword = 'test-password-123'
  const testText = 'Hello, this is a test message!'

  describe('encrypt', () => {
    it('should encrypt text successfully', () => {
      const encrypted = encrypt(testText, testPassword)
      
      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted.split(':')).toHaveLength(3) // salt:iv:encrypted format
    })

    it('should produce different output for same input (due to random salt/iv)', () => {
      const encrypted1 = encrypt(testText, testPassword)
      const encrypted2 = encrypt(testText, testPassword)
      
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should handle empty text', () => {
      const encrypted = encrypt('', testPassword)
      
      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
    })
  })

  describe('decrypt', () => {
    it('should decrypt text successfully', () => {
      const encrypted = encrypt(testText, testPassword)
      const decrypted = decrypt(encrypted, testPassword)
      
      expect(decrypted).toBe(testText)
    })

    it('should handle empty text encryption/decryption', () => {
      const encrypted = encrypt('', testPassword)
      const decrypted = decrypt(encrypted, testPassword)
      
      expect(decrypted).toBe('')
    })

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid-format', testPassword)).toThrow('Invalid encrypted format')
      expect(() => decrypt('only-one-part', testPassword)).toThrow('Invalid encrypted format')
      
      // Test with properly formatted but invalid data
      expect(() => decrypt('dGVzdA==:dGVzdA==:invalid-base64', testPassword)).toThrow()
    })

    it('should throw error for wrong password', () => {
      const encrypted = encrypt(testText, testPassword)
      
      expect(() => decrypt(encrypted, 'wrong-password')).toThrow()
    })
  })

  describe('encrypt/decrypt integration', () => {
    it('should handle various text lengths', () => {
      const texts = [
        'short',
        'This is a medium length text that should work fine.',
        'This is a very long text that contains multiple sentences and should test the encryption and decryption process with larger amounts of data to ensure it works correctly in all scenarios.',
      ]

      texts.forEach(text => {
        const encrypted = encrypt(text, testPassword)
        const decrypted = decrypt(encrypted, testPassword)
        expect(decrypted).toBe(text)
      })
    })

    it('should handle special characters', () => {
      const specialText = 'Héllo, wörld! 🌍 Special chars: @#$%^&*()_+-={}[]|\\:";\'<>?,./'
      const encrypted = encrypt(specialText, testPassword)
      const decrypted = decrypt(encrypted, testPassword)
      
      expect(decrypted).toBe(specialText)
    })
  })
})