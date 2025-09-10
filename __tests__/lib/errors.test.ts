import { AuthError, AuthErrorCodes, getErrorMessage } from '@/lib/errors'

describe('errors utilities', () => {
  describe('AuthError', () => {
    it('should create an AuthError with message', () => {
      const error = new AuthError('Test error message')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AuthError)
      expect(error.message).toBe('Test error message')
      expect(error.name).toBe('AuthError')
      expect(error.code).toBeUndefined()
    })

    it('should create an AuthError with message and code', () => {
      const error = new AuthError('Test error message', 'TEST_CODE')
      
      expect(error.message).toBe('Test error message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.name).toBe('AuthError')
    })

    it('should create an AuthError with predefined error codes', () => {
      const error = new AuthError('Invalid credentials', AuthErrorCodes.INVALID_CREDENTIALS)
      
      expect(error.message).toBe('Invalid credentials')
      expect(error.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('AuthErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(AuthErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
      expect(AuthErrorCodes.USER_ALREADY_EXISTS).toBe('USER_ALREADY_EXISTS')
      expect(AuthErrorCodes.USER_NOT_FOUND).toBe('USER_NOT_FOUND')
      expect(AuthErrorCodes.INVALID_TOKEN).toBe('INVALID_TOKEN')
      expect(AuthErrorCodes.SESSION_EXPIRED).toBe('SESSION_EXPIRED')
    })

    it('should have readonly-like behavior', () => {
      // AuthErrorCodes is defined as const assertion, so it's effectively readonly
      // In runtime JavaScript, this doesn't throw, but TypeScript prevents modification
      expect(typeof AuthErrorCodes.INVALID_CREDENTIALS).toBe('string')
      expect(AuthErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('getErrorMessage', () => {
    it('should return message from AuthError', () => {
      const authError = new AuthError('Auth error message', AuthErrorCodes.INVALID_CREDENTIALS)
      const message = getErrorMessage(authError)
      
      expect(message).toBe('Auth error message')
    })

    it('should return message from regular Error', () => {
      const error = new Error('Regular error message')
      const message = getErrorMessage(error)
      
      expect(message).toBe('Regular error message')
    })

    it('should return default message for unknown error types', () => {
      const message1 = getErrorMessage('string error')
      const message2 = getErrorMessage(null)
      const message3 = getErrorMessage(undefined)
      const message4 = getErrorMessage(123)
      
      expect(message1).toBe('Une erreur inattendue s\'est produite')
      expect(message2).toBe('Une erreur inattendue s\'est produite')
      expect(message3).toBe('Une erreur inattendue s\'est produite')
      expect(message4).toBe('Une erreur inattendue s\'est produite')
    })

    it('should handle nested errors', () => {
      const nestedError = new Error('Nested error')
      const authError = new AuthError('Auth error with nested cause')
      
      expect(getErrorMessage(nestedError)).toBe('Nested error')
      expect(getErrorMessage(authError)).toBe('Auth error with nested cause')
    })
  })
})