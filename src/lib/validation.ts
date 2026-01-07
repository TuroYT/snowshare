/**
 * Validation utilities for share operations
 */

// URL validation pattern - matches various URL formats
const URL_PATTERN = new RegExp(
  "^(https?:\\/\\/)?" + // protocol
    "((([a-z0-9\\-]+\\.)+[a-z]{2,})|" + // domain name
    "localhost|" + // localhost
    "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|" + // IP address
    "\\[?[a-f0-9:\\.]+\\]?)" + // IPv6
    "(\\:\\d+)?(\\/[^\\s]*)?$",
  "i"
);

// Slug validation pattern - alphanumeric, dashes, underscores, 3-30 chars
const SLUG_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

// Password constraints
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;

// Max days for anonymous users
export const MAX_ANON_EXPIRY_DAYS = 7;

/**
 * Validates a URL string
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return URL_PATTERN.test(url);
}

/**
 * Validates a slug string
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return SLUG_PATTERN.test(slug);
}

/**
 * Validates a password string
 */
export function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * Validates an expiration date
 */
export function isValidExpirationDate(expiresAt: Date | string): { valid: boolean; error?: string } {
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  if (date <= new Date()) {
    return { valid: false, error: 'Expiration date must be in the future' };
  }
  
  return { valid: true };
}

/**
 * Validates expiration date for anonymous users (max 7 days)
 */
export function isValidAnonExpirationDate(expiresAt: Date | string): { valid: boolean; error?: string } {
  const baseValidation = isValidExpirationDate(expiresAt);
  if (!baseValidation.valid) return baseValidation;
  
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const maxExpiry = new Date();
  maxExpiry.setDate(maxExpiry.getDate() + MAX_ANON_EXPIRY_DAYS);
  
  if (date > maxExpiry) {
    return { valid: false, error: `Anonymous users cannot create shares expiring beyond ${MAX_ANON_EXPIRY_DAYS} days` };
  }
  
  return { valid: true };
}

/**
 * Validates paste content
 */
export function isValidPasteContent(paste: string): { valid: boolean; error?: string } {
  if (!paste || typeof paste !== 'string') {
    return { valid: false, error: 'Paste content is required' };
  }
  if (paste.length < 1) {
    return { valid: false, error: 'Paste content cannot be empty' };
  }
  return { valid: true };
}

/**
 * Validates paste language
 */
export function isValidPasteLanguage(language: string): { valid: boolean; error?: string } {
  if (!language || typeof language !== 'string') {
    return { valid: false, error: 'Paste language is required' };
  }
  return { valid: true };
}

/**
 * File validation utilities
 */
export interface FileValidationOptions {
  maxSize: number;
  maxNameLength?: number;
}

export function validateFilename(filename: string, maxLength = 255): { valid: boolean; error?: string } {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: 'Filename is required' };
  }
  
  if (filename.length > maxLength) {
    return { valid: false, error: `Filename is too long (maximum ${maxLength} characters)` };
  }
  
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename' };
  }
  
  return { valid: true };
}

export function validateFileSize(size: number, maxSize: number): { valid: boolean; error?: string } {
  if (typeof size !== 'number' || size < 0) {
    return { valid: false, error: 'Invalid file size' };
  }
  
  if (size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size exceeds the limit of ${maxSizeMB}MB` };
  }
  
  return { valid: true };
}

/**
 * Generates a safe filename from an original name
 */
export function generateSafeFilename(originalName: string, shareId: string): string {
  // Extract extension
  const lastDotIndex = originalName.lastIndexOf('.');
  const ext = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';
  const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
  
  // Sanitize base name
  const sanitizedBase = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  return `${shareId}_${sanitizedBase}${ext}`;
}

/**
 * Validates an OAuth provider display name
 */
export function isValidDisplayName(displayName: string, maxLength = 100): { valid: boolean; error?: string } {
  if (typeof displayName !== 'string') {
    return { valid: false, error: 'displayName must be a string' };
  }
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'displayName is required' };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `displayName must be at most ${maxLength} characters` };
  }
  return { valid: true };
}
