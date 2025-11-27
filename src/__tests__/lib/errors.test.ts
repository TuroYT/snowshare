/**
 * Tests for the errors module
 */
import { AuthError, AuthErrorCodes, getErrorMessage } from '@/lib/errors';

describe('errors', () => {
  describe('AuthError', () => {
    it('should create an error with message', () => {
      const error = new AuthError('Test error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('AuthError');
    });

    it('should create an error with message and code', () => {
      const error = new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
      
      expect(error.message).toBe('Invalid credentials');
      expect(error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should have undefined code when not provided', () => {
      const error = new AuthError('Error without code');
      
      expect(error.code).toBeUndefined();
    });

    it('should be throwable and catchable', () => {
      const throwError = () => {
        throw new AuthError('Thrown error', 'TEST_CODE');
      };

      expect(throwError).toThrow(AuthError);
      expect(throwError).toThrow('Thrown error');
    });

    it('should have correct stack trace', () => {
      const error = new AuthError('Stack trace test');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AuthError');
    });
  });

  describe('AuthErrorCodes', () => {
    it('should have INVALID_CREDENTIALS code', () => {
      expect(AuthErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    });

    it('should have USER_ALREADY_EXISTS code', () => {
      expect(AuthErrorCodes.USER_ALREADY_EXISTS).toBe('USER_ALREADY_EXISTS');
    });

    it('should have USER_NOT_FOUND code', () => {
      expect(AuthErrorCodes.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
    });

    it('should have INVALID_TOKEN code', () => {
      expect(AuthErrorCodes.INVALID_TOKEN).toBe('INVALID_TOKEN');
    });

    it('should have SESSION_EXPIRED code', () => {
      expect(AuthErrorCodes.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
    });

    it('should be read-only (const)', () => {
      // TypeScript ensures this at compile time, but we can verify the values exist
      const codes = Object.keys(AuthErrorCodes);
      expect(codes).toHaveLength(5);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from AuthError', () => {
      const error = new AuthError('Auth error message');
      
      expect(getErrorMessage(error)).toBe('Auth error message');
    });

    it('should return message from standard Error', () => {
      const error = new Error('Standard error message');
      
      expect(getErrorMessage(error)).toBe('Standard error message');
    });

    it('should return default message for unknown error types', () => {
      expect(getErrorMessage('string error')).toBe("Une erreur inattendue s'est produite");
      expect(getErrorMessage(123)).toBe("Une erreur inattendue s'est produite");
      expect(getErrorMessage(null)).toBe("Une erreur inattendue s'est produite");
      expect(getErrorMessage(undefined)).toBe("Une erreur inattendue s'est produite");
      expect(getErrorMessage({})).toBe("Une erreur inattendue s'est produite");
    });

    it('should prioritize AuthError over Error', () => {
      const authError = new AuthError('Auth specific message');
      
      // AuthError is also an Error, so this tests the order of checks
      expect(getErrorMessage(authError)).toBe('Auth specific message');
    });

    it('should handle Error subclasses', () => {
      const typeError = new TypeError('Type error');
      const rangeError = new RangeError('Range error');
      
      expect(getErrorMessage(typeError)).toBe('Type error');
      expect(getErrorMessage(rangeError)).toBe('Range error');
    });
  });
});
