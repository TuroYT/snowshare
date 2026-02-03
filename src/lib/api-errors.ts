/**
 * Centralized API error handling with i18n support
 * Provides consistent error responses across all API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { detectLocale, translate } from "./i18n-server";

/**
 * API Error Codes
 * Each code maps to a specific error message in the translation files
 */
export enum ErrorCode {
  // General errors (500, 400)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVER_CONFIG_ERROR = "SERVER_CONFIG_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  MISSING_DATA = "MISSING_DATA",
  INVALID_JSON = "INVALID_JSON",

  // Authentication & Authorization errors (401, 403)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  ADMIN_ONLY = "ADMIN_ONLY",
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED",

  // User registration & authentication (400, 403, 404)
  SIGNUP_DISABLED = "SIGNUP_DISABLED",
  USERS_ALREADY_EXIST = "USERS_ALREADY_EXIST",
  EMAIL_PASSWORD_REQUIRED = "EMAIL_PASSWORD_REQUIRED",
  INVALID_EMAIL_FORMAT = "INVALID_EMAIL_FORMAT",
  PASSWORD_LENGTH = "PASSWORD_LENGTH",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  CURRENT_PASSWORD_REQUIRED = "CURRENT_PASSWORD_REQUIRED",
  INCORRECT_CURRENT_PASSWORD = "INCORRECT_CURRENT_PASSWORD",

  // Slug & URL validation (400)
  SLUG_ALREADY_TAKEN = "SLUG_ALREADY_TAKEN",
  SLUG_INVALID = "SLUG_INVALID",
  INVALID_URL = "INVALID_URL",
  INVALID_URL_FORMAT = "INVALID_URL_FORMAT",
  URL_PROTOCOL_NOT_ALLOWED = "URL_PROTOCOL_NOT_ALLOWED",
  URL_TOO_LONG = "URL_TOO_LONG",
  URL_REQUIRED = "URL_REQUIRED",

  // Password validation (400)
  PASSWORD_INVALID_LENGTH = "PASSWORD_INVALID_LENGTH",
  PASSWORDS_MISMATCH = "PASSWORDS_MISMATCH",
  PASSWORD_INCORRECT = "PASSWORD_INCORRECT",

  // Expiration validation (400)
  EXPIRATION_IN_PAST = "EXPIRATION_IN_PAST",
  EXPIRATION_TOO_FAR = "EXPIRATION_TOO_FAR",
  EXPIRATION_REQUIRED = "EXPIRATION_REQUIRED",

  // Anonymous user restrictions (403)
  ANON_LINK_SHARE_DISABLED = "ANON_LINK_SHARE_DISABLED",
  ANON_FILE_SHARE_DISABLED = "ANON_FILE_SHARE_DISABLED",
  ANON_PASTE_SHARE_DISABLED = "ANON_PASTE_SHARE_DISABLED",

  // Paste validation (400)
  PASTE_CONTENT_REQUIRED = "PASTE_CONTENT_REQUIRED",
  PASTE_CONTENT_EMPTY = "PASTE_CONTENT_EMPTY",
  PASTE_LANGUAGE_REQUIRED = "PASTE_LANGUAGE_REQUIRED",
  PASTE_LANGUAGE_INVALID = "PASTE_LANGUAGE_INVALID",

  // File validation (400)
  FILE_REQUIRED = "FILE_REQUIRED",
  FILENAME_REQUIRED = "FILENAME_REQUIRED",
  FILENAME_TOO_LONG = "FILENAME_TOO_LONG",
  FILENAME_INVALID = "FILENAME_INVALID",
  FILE_SIZE_INVALID = "FILE_SIZE_INVALID",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_TYPE_NOT_ALLOWED = "FILE_TYPE_NOT_ALLOWED",

  // Quota errors (403, 413)
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  IP_QUOTA_EXCEEDED = "IP_QUOTA_EXCEEDED",
  USER_QUOTA_EXCEEDED = "USER_QUOTA_EXCEEDED",

  // Resource errors (404, 400, 403, 410)
  SHARE_NOT_FOUND = "SHARE_NOT_FOUND",
  SHARE_EXPIRED = "SHARE_EXPIRED",
  SHARE_TYPE_REQUIRED = "SHARE_TYPE_REQUIRED",
  SHARE_TYPE_INVALID = "SHARE_TYPE_INVALID",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PASSWORD_REQUIRED = "PASSWORD_REQUIRED",

  // OAuth & SSO (400, 404)
  DISPLAY_NAME_REQUIRED = "DISPLAY_NAME_REQUIRED",
  DISPLAY_NAME_TOO_LONG = "DISPLAY_NAME_TOO_LONG",
  INVALID_DISPLAY_NAME = "INVALID_DISPLAY_NAME",
  PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
  NO_SSO_PROVIDERS = "NO_SSO_PROVIDERS",

  // Custom links (400)
  LINK_NAME_REQUIRED = "LINK_NAME_REQUIRED",
  LINK_URL_REQUIRED = "LINK_URL_REQUIRED",
  LINK_URL_INVALID = "LINK_URL_INVALID",

  // Account management (400, 404)
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  ACCOUNT_ALREADY_LINKED = "ACCOUNT_ALREADY_LINKED",
  ACCOUNT_LINKING_FAILED = "ACCOUNT_LINKING_FAILED",
  CANNOT_UNLINK_LAST_ACCOUNT = "CANNOT_UNLINK_LAST_ACCOUNT",

  // Token validation (400)
  TOKEN_REQUIRED = "TOKEN_REQUIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID_OR_EXPIRED = "TOKEN_INVALID_OR_EXPIRED",

  // Date validation (400)
  INVALID_DATE_FORMAT = "INVALID_DATE_FORMAT",
  INVALID_EXPIRATION_DATE = "INVALID_EXPIRATION_DATE",
}

/**
 * Maps error codes to HTTP status codes
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  // 500 errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.SERVER_CONFIG_ERROR]: 500,

  // 400 errors (Bad Request)
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.MISSING_DATA]: 400,
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.EMAIL_PASSWORD_REQUIRED]: 400,
  [ErrorCode.INVALID_EMAIL_FORMAT]: 400,
  [ErrorCode.PASSWORD_LENGTH]: 400,
  [ErrorCode.USER_ALREADY_EXISTS]: 400,
  [ErrorCode.SLUG_INVALID]: 400,
  [ErrorCode.SLUG_ALREADY_TAKEN]: 400,
  [ErrorCode.INVALID_URL]: 400,
  [ErrorCode.INVALID_URL_FORMAT]: 400,
  [ErrorCode.URL_PROTOCOL_NOT_ALLOWED]: 400,
  [ErrorCode.URL_TOO_LONG]: 400,
  [ErrorCode.URL_REQUIRED]: 400,
  [ErrorCode.PASSWORD_INVALID_LENGTH]: 400,
  [ErrorCode.PASSWORDS_MISMATCH]: 400,
  [ErrorCode.PASSWORD_INCORRECT]: 400,
  [ErrorCode.EXPIRATION_IN_PAST]: 400,
  [ErrorCode.EXPIRATION_TOO_FAR]: 400,
  [ErrorCode.EXPIRATION_REQUIRED]: 400,
  [ErrorCode.PASTE_CONTENT_REQUIRED]: 400,
  [ErrorCode.PASTE_CONTENT_EMPTY]: 400,
  [ErrorCode.PASTE_LANGUAGE_REQUIRED]: 400,
  [ErrorCode.PASTE_LANGUAGE_INVALID]: 400,
  [ErrorCode.FILE_REQUIRED]: 400,
  [ErrorCode.FILENAME_REQUIRED]: 400,
  [ErrorCode.FILENAME_TOO_LONG]: 400,
  [ErrorCode.FILENAME_INVALID]: 400,
  [ErrorCode.FILE_SIZE_INVALID]: 400,
  [ErrorCode.SHARE_TYPE_REQUIRED]: 400,
  [ErrorCode.SHARE_TYPE_INVALID]: 400,
  [ErrorCode.DISPLAY_NAME_REQUIRED]: 400,
  [ErrorCode.DISPLAY_NAME_TOO_LONG]: 400,
  [ErrorCode.INVALID_DISPLAY_NAME]: 400,
  [ErrorCode.LINK_NAME_REQUIRED]: 400,
  [ErrorCode.LINK_URL_REQUIRED]: 400,
  [ErrorCode.LINK_URL_INVALID]: 400,
  [ErrorCode.INVALID_DATE_FORMAT]: 400,
  [ErrorCode.INVALID_EXPIRATION_DATE]: 400,
  [ErrorCode.CURRENT_PASSWORD_REQUIRED]: 400,
  [ErrorCode.INCORRECT_CURRENT_PASSWORD]: 400,
  [ErrorCode.CANNOT_UNLINK_LAST_ACCOUNT]: 400,
  [ErrorCode.ACCOUNT_ALREADY_LINKED]: 400,
  [ErrorCode.ACCOUNT_LINKING_FAILED]: 400,
  [ErrorCode.TOKEN_REQUIRED]: 400,
  [ErrorCode.TOKEN_INVALID]: 400,
  [ErrorCode.TOKEN_EXPIRED]: 400,
  [ErrorCode.TOKEN_INVALID_OR_EXPIRED]: 400,

  // 401 errors (Unauthorized)
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.AUTHENTICATION_REQUIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,

  // 403 errors (Forbidden)
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ADMIN_ONLY]: 403,
  [ErrorCode.SIGNUP_DISABLED]: 403,
  [ErrorCode.USERS_ALREADY_EXIST]: 403,
  [ErrorCode.ANON_LINK_SHARE_DISABLED]: 403,
  [ErrorCode.ANON_FILE_SHARE_DISABLED]: 403,
  [ErrorCode.ANON_PASTE_SHARE_DISABLED]: 403,
  [ErrorCode.QUOTA_EXCEEDED]: 403,
  [ErrorCode.IP_QUOTA_EXCEEDED]: 403,
  [ErrorCode.USER_QUOTA_EXCEEDED]: 403,
  [ErrorCode.NO_SSO_PROVIDERS]: 403,
  [ErrorCode.PASSWORD_REQUIRED]: 403,

  // 404 errors (Not Found)
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.SHARE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.PROVIDER_NOT_FOUND]: 404,
  [ErrorCode.ACCOUNT_NOT_FOUND]: 404,

  // 410 errors (Gone)
  [ErrorCode.SHARE_EXPIRED]: 410,

  // 413 errors (Payload Too Large)
  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: 415,
};

/**
 * Maps error codes to translation keys
 */
function getTranslationKey(code: ErrorCode): string {
  // Convert enum value to lowercase with underscores for translation key
  // e.g., INVALID_EMAIL_FORMAT -> api.errors.invalid_email_format
  return `api.errors.${code.toLowerCase()}`;
}

/**
 * Interface for error response
 */
export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
}

/**
 * Parameters for error interpolation
 */
export type ErrorParams = Record<string, string | number | undefined>;

/**
 * Creates a standardized error response with i18n support
 *
 * @param request - The Next.js request object (for locale detection)
 * @param code - The error code from the ErrorCode enum
 * @param params - Optional parameters for message interpolation (e.g., {min: 6, max: 100})
 * @returns NextResponse with translated error message and appropriate status code
 *
 * @example
 * // Simple error
 * return apiError(request, ErrorCode.USER_NOT_FOUND);
 *
 * @example
 * // Error with interpolation
 * return apiError(request, ErrorCode.PASSWORD_LENGTH, { min: 6, max: 100 });
 */
export function apiError(
  request: NextRequest,
  code: ErrorCode,
  params?: ErrorParams
): NextResponse<ApiErrorResponse> {
  const locale = detectLocale(request);
  const translationKey = getTranslationKey(code);
  const message = translate(locale, translationKey, params);
  const status = ERROR_STATUS_MAP[code] || 500;

  return NextResponse.json(
    {
      error: message,
      code: code,
    },
    { status }
  );
}

/**
 * Helper to create a generic internal server error
 * Use this for unexpected errors in try-catch blocks
 *
 * @param request - The Next.js request object
 * @returns NextResponse with 500 status
 *
 * @example
 * try {
 *   // ... some operation
 * } catch (error) {
 *   console.error("Operation failed:", error);
 *   return internalError(request);
 * }
 */
export function internalError(request: NextRequest): NextResponse<ApiErrorResponse> {
  return apiError(request, ErrorCode.INTERNAL_SERVER_ERROR);
}

/**
 * Helper to check if user is authenticated
 * Returns error response if not authenticated, otherwise returns null
 *
 * @param session - The NextAuth session object
 * @param request - The Next.js request object
 * @returns NextResponse if not authenticated, null otherwise
 *
 * @example
 * const authError = requireAuth(session, request);
 * if (authError) return authError;
 * // User is authenticated, continue...
 */
export function requireAuth(
  session: unknown,
  request: NextRequest
): NextResponse<ApiErrorResponse> | null {
  if (!session) {
    return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);
  }
  return null;
}

/**
 * Helper to check if user is admin
 * Returns error response if not admin, otherwise returns null
 *
 * @param isAdmin - Whether the user is admin
 * @param request - The Next.js request object
 * @returns NextResponse if not admin, null otherwise
 *
 * @example
 * const adminError = requireAdmin(session.user.isAdmin, request);
 * if (adminError) return adminError;
 * // User is admin, continue...
 */
export function requireAdmin(
  isAdmin: boolean,
  request: NextRequest
): NextResponse<ApiErrorResponse> | null {
  if (!isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }
  return null;
}
