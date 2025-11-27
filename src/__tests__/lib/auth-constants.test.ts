/**
 * Tests for the auth-constants module
 */
import { AUTH_CONSTANTS, AUTH_ROUTES, AUTH_MESSAGES } from '@/lib/auth-constants';

describe('auth-constants', () => {
  describe('AUTH_CONSTANTS', () => {
    it('should have a valid MIN_PASSWORD_LENGTH', () => {
      expect(AUTH_CONSTANTS.MIN_PASSWORD_LENGTH).toBe(6);
      expect(typeof AUTH_CONSTANTS.MIN_PASSWORD_LENGTH).toBe('number');
    });

    it('should have a valid MAX_PASSWORD_LENGTH', () => {
      expect(AUTH_CONSTANTS.MAX_PASSWORD_LENGTH).toBe(128);
      expect(typeof AUTH_CONSTANTS.MAX_PASSWORD_LENGTH).toBe('number');
      expect(AUTH_CONSTANTS.MAX_PASSWORD_LENGTH).toBeGreaterThan(AUTH_CONSTANTS.MIN_PASSWORD_LENGTH);
    });

    it('should have a valid SESSION_MAX_AGE', () => {
      expect(AUTH_CONSTANTS.SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60); // 30 days in seconds
      expect(typeof AUTH_CONSTANTS.SESSION_MAX_AGE).toBe('number');
    });

    it('should have a valid SALT_ROUNDS', () => {
      expect(AUTH_CONSTANTS.SALT_ROUNDS).toBe(12);
      expect(typeof AUTH_CONSTANTS.SALT_ROUNDS).toBe('number');
      // bcrypt recommends at least 10 rounds for security
      expect(AUTH_CONSTANTS.SALT_ROUNDS).toBeGreaterThanOrEqual(10);
    });
  });

  describe('AUTH_ROUTES', () => {
    it('should have a valid SIGN_IN route', () => {
      expect(AUTH_ROUTES.SIGN_IN).toBe('/auth/signin');
      expect(AUTH_ROUTES.SIGN_IN.startsWith('/')).toBe(true);
    });

    it('should have a valid SIGN_UP route', () => {
      expect(AUTH_ROUTES.SIGN_UP).toBe('/auth/signup');
      expect(AUTH_ROUTES.SIGN_UP.startsWith('/')).toBe(true);
    });

    it('should have a valid SIGN_OUT route', () => {
      expect(AUTH_ROUTES.SIGN_OUT).toBe('/auth/signout');
      expect(AUTH_ROUTES.SIGN_OUT.startsWith('/')).toBe(true);
    });

    it('should have a valid HOME route', () => {
      expect(AUTH_ROUTES.HOME).toBe('/');
    });

    it('should have a valid DASHBOARD route', () => {
      expect(AUTH_ROUTES.DASHBOARD).toBe('/dashboard');
      expect(AUTH_ROUTES.DASHBOARD.startsWith('/')).toBe(true);
    });

    it('should have all routes as strings', () => {
      Object.values(AUTH_ROUTES).forEach(route => {
        expect(typeof route).toBe('string');
      });
    });
  });

  describe('AUTH_MESSAGES', () => {
    it('should have SIGN_IN_SUCCESS message', () => {
      expect(AUTH_MESSAGES.SIGN_IN_SUCCESS).toBe('Connexion réussie');
      expect(typeof AUTH_MESSAGES.SIGN_IN_SUCCESS).toBe('string');
    });

    it('should have SIGN_OUT_SUCCESS message', () => {
      expect(AUTH_MESSAGES.SIGN_OUT_SUCCESS).toBe('Déconnexion réussie');
      expect(typeof AUTH_MESSAGES.SIGN_OUT_SUCCESS).toBe('string');
    });

    it('should have SIGN_UP_SUCCESS message', () => {
      expect(AUTH_MESSAGES.SIGN_UP_SUCCESS).toBe('Compte créé avec succès');
      expect(typeof AUTH_MESSAGES.SIGN_UP_SUCCESS).toBe('string');
    });

    it('should have INVALID_CREDENTIALS message', () => {
      expect(AUTH_MESSAGES.INVALID_CREDENTIALS).toBe('Email ou mot de passe incorrect');
      expect(typeof AUTH_MESSAGES.INVALID_CREDENTIALS).toBe('string');
    });

    it('should have PASSWORD_TOO_SHORT message that references MIN_PASSWORD_LENGTH', () => {
      expect(AUTH_MESSAGES.PASSWORD_TOO_SHORT).toContain(
        AUTH_CONSTANTS.MIN_PASSWORD_LENGTH.toString()
      );
    });

    it('should have EMAIL_REQUIRED message', () => {
      expect(AUTH_MESSAGES.EMAIL_REQUIRED).toBe("L'email est requis");
      expect(typeof AUTH_MESSAGES.EMAIL_REQUIRED).toBe('string');
    });

    it('should have PASSWORD_REQUIRED message', () => {
      expect(AUTH_MESSAGES.PASSWORD_REQUIRED).toBe('Le mot de passe est requis');
      expect(typeof AUTH_MESSAGES.PASSWORD_REQUIRED).toBe('string');
    });

    it('should have PASSWORDS_DO_NOT_MATCH message', () => {
      expect(AUTH_MESSAGES.PASSWORDS_DO_NOT_MATCH).toBe('Les mots de passe ne correspondent pas');
      expect(typeof AUTH_MESSAGES.PASSWORDS_DO_NOT_MATCH).toBe('string');
    });

    it('should have USER_ALREADY_EXISTS message', () => {
      expect(AUTH_MESSAGES.USER_ALREADY_EXISTS).toBe('Un utilisateur avec cet email existe déjà');
      expect(typeof AUTH_MESSAGES.USER_ALREADY_EXISTS).toBe('string');
    });

    it('should have all messages as non-empty strings', () => {
      Object.values(AUTH_MESSAGES).forEach(message => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
