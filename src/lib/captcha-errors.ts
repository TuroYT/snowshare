/**
 * CAPTCHA error code mapping and user-friendly messages
 * Provides clear, actionable error messages for CAPTCHA failures
 */

export enum CaptchaErrorCode {
  // Generic errors
  GENERIC_ERROR = "generic_error",
  DISABLED = "disabled",
  NOT_CONFIGURED = "not_configured",
  TOKEN_MISSING = "token_missing",
  
  // Provider errors
  INVALID_SECRET = "invalid_secret",
  INVALID_RESPONSE = "invalid_response",
  TIMEOUT_OR_DUPLICATE = "timeout_or_duplicate",
  BAD_REQUEST = "bad_request",
  
  // Network errors
  NETWORK_ERROR = "network_error",
  SERVICE_UNAVAILABLE = "service_unavailable",
  
  // Validation errors
  SCORE_TOO_LOW = "score_too_low",
  ACTION_MISMATCH = "action_mismatch",
  HOSTNAME_MISMATCH = "hostname_mismatch",
  
  // Configuration errors
  WRONG_SITE_KEY = "wrong_site_key",
  UNKNOWN_PROVIDER = "unknown_provider",
}

export interface CaptchaError {
  code: CaptchaErrorCode
  message: string
  userMessage: string
  technicalDetails?: string
  suggestion?: string
}

/**
 * Map CAPTCHA error codes to user-friendly messages
 */
export const CAPTCHA_ERROR_MESSAGES: Record<CaptchaErrorCode, CaptchaError> = {
  [CaptchaErrorCode.GENERIC_ERROR]: {
    code: CaptchaErrorCode.GENERIC_ERROR,
    message: "CAPTCHA validation failed",
    userMessage: "Verification failed. Please try again.",
    suggestion: "Refresh the page and complete the verification again.",
  },
  
  [CaptchaErrorCode.DISABLED]: {
    code: CaptchaErrorCode.DISABLED,
    message: "CAPTCHA is not enabled",
    userMessage: "Verification is not required.",
    suggestion: "You can proceed without completing CAPTCHA.",
  },
  
  [CaptchaErrorCode.NOT_CONFIGURED]: {
    code: CaptchaErrorCode.NOT_CONFIGURED,
    message: "CAPTCHA is not properly configured",
    userMessage: "Verification system is not available.",
    technicalDetails: "CAPTCHA provider or keys are missing in settings",
    suggestion: "Contact the administrator to configure CAPTCHA settings.",
  },
  
  [CaptchaErrorCode.TOKEN_MISSING]: {
    code: CaptchaErrorCode.TOKEN_MISSING,
    message: "CAPTCHA token is missing",
    userMessage: "Please complete the verification challenge.",
    suggestion: "Make sure to complete the CAPTCHA before submitting.",
  },
  
  [CaptchaErrorCode.INVALID_SECRET]: {
    code: CaptchaErrorCode.INVALID_SECRET,
    message: "Invalid CAPTCHA secret key",
    userMessage: "Verification system is misconfigured.",
    technicalDetails: "The secret key provided does not match the provider's records",
    suggestion: "Administrator: Check your CAPTCHA secret key in the admin settings.",
  },
  
  [CaptchaErrorCode.INVALID_RESPONSE]: {
    code: CaptchaErrorCode.INVALID_RESPONSE,
    message: "Invalid CAPTCHA response token",
    userMessage: "Verification failed. Please try again.",
    technicalDetails: "The response token is malformed or invalid",
    suggestion: "Complete the CAPTCHA challenge again.",
  },
  
  [CaptchaErrorCode.TIMEOUT_OR_DUPLICATE]: {
    code: CaptchaErrorCode.TIMEOUT_OR_DUPLICATE,
    message: "CAPTCHA token expired or already used",
    userMessage: "Verification has expired. Please try again.",
    technicalDetails: "Tokens expire after a few minutes or can only be used once",
    suggestion: "Refresh the page and complete a fresh verification.",
  },
  
  [CaptchaErrorCode.BAD_REQUEST]: {
    code: CaptchaErrorCode.BAD_REQUEST,
    message: "Invalid CAPTCHA request format",
    userMessage: "Verification request is invalid.",
    technicalDetails: "The request to the CAPTCHA provider was malformed",
    suggestion: "This is a technical issue. Please contact support.",
  },
  
  [CaptchaErrorCode.NETWORK_ERROR]: {
    code: CaptchaErrorCode.NETWORK_ERROR,
    message: "Failed to connect to CAPTCHA service",
    userMessage: "Unable to verify your response. Please try again.",
    technicalDetails: "Network request to CAPTCHA provider failed",
    suggestion: "Check your internet connection or try again in a moment.",
  },
  
  [CaptchaErrorCode.SERVICE_UNAVAILABLE]: {
    code: CaptchaErrorCode.SERVICE_UNAVAILABLE,
    message: "CAPTCHA service is temporarily unavailable",
    userMessage: "Verification service is temporarily down.",
    technicalDetails: "The CAPTCHA provider returned a 5xx error",
    suggestion: "Please try again in a few minutes.",
  },
  
  [CaptchaErrorCode.SCORE_TOO_LOW]: {
    code: CaptchaErrorCode.SCORE_TOO_LOW,
    message: "CAPTCHA score below threshold",
    userMessage: "Unable to verify you're human. Please try again.",
    technicalDetails: "reCAPTCHA v3 score is below the required threshold",
    suggestion: "Try a different action or use a different browser.",
  },
  
  [CaptchaErrorCode.ACTION_MISMATCH]: {
    code: CaptchaErrorCode.ACTION_MISMATCH,
    message: "CAPTCHA action does not match",
    userMessage: "Verification context mismatch.",
    technicalDetails: "The action in the token doesn't match expected action",
    suggestion: "This is a technical issue. Please refresh and try again.",
  },
  
  [CaptchaErrorCode.HOSTNAME_MISMATCH]: {
    code: CaptchaErrorCode.HOSTNAME_MISMATCH,
    message: "CAPTCHA hostname does not match",
    userMessage: "Verification domain mismatch.",
    technicalDetails: "The hostname in the token doesn't match the current domain",
    suggestion: "Administrator: Ensure site key matches your domain in CAPTCHA settings.",
  },
  
  [CaptchaErrorCode.WRONG_SITE_KEY]: {
    code: CaptchaErrorCode.WRONG_SITE_KEY,
    message: "CAPTCHA site key mismatch",
    userMessage: "Verification configuration error.",
    technicalDetails: "The site key used doesn't match the secret key",
    suggestion: "Administrator: Verify your site key and secret key match in CAPTCHA dashboard.",
  },
  
  [CaptchaErrorCode.UNKNOWN_PROVIDER]: {
    code: CaptchaErrorCode.UNKNOWN_PROVIDER,
    message: "Unknown CAPTCHA provider",
    userMessage: "Verification system type is not supported.",
    technicalDetails: "The configured CAPTCHA provider is not recognized",
    suggestion: "Administrator: Choose a supported provider (reCAPTCHA v2/v3 or Turnstile).",
  },
}

/**
 * Get error details by code
 */
export function getCaptchaError(code: CaptchaErrorCode): CaptchaError {
  return CAPTCHA_ERROR_MESSAGES[code] || CAPTCHA_ERROR_MESSAGES[CaptchaErrorCode.GENERIC_ERROR]
}

/**
 * Map provider error codes to our internal codes
 */
export function mapProviderErrorCode(provider: string, providerErrorCode: string): CaptchaErrorCode {
  if (provider === "recaptcha-v2" || provider === "recaptcha-v3") {
    switch (providerErrorCode) {
      case "missing-input-secret":
      case "invalid-input-secret":
        return CaptchaErrorCode.INVALID_SECRET
      case "missing-input-response":
        return CaptchaErrorCode.TOKEN_MISSING
      case "invalid-input-response":
        return CaptchaErrorCode.INVALID_RESPONSE
      case "timeout-or-duplicate":
        return CaptchaErrorCode.TIMEOUT_OR_DUPLICATE
      case "bad-request":
        return CaptchaErrorCode.BAD_REQUEST
      default:
        return CaptchaErrorCode.GENERIC_ERROR
    }
  }
  
  if (provider === "turnstile") {
    switch (providerErrorCode) {
      case "invalid-input-secret":
        return CaptchaErrorCode.INVALID_SECRET
      case "missing-input-response":
        return CaptchaErrorCode.TOKEN_MISSING
      case "invalid-input-response":
        return CaptchaErrorCode.INVALID_RESPONSE
      case "timeout-or-duplicate":
        return CaptchaErrorCode.TIMEOUT_OR_DUPLICATE
      case "bad-request":
        return CaptchaErrorCode.BAD_REQUEST
      case "invalid-widget-id":
      case "invalid-parsed-secret":
        return CaptchaErrorCode.WRONG_SITE_KEY
      default:
        return CaptchaErrorCode.GENERIC_ERROR
    }
  }
  
  return CaptchaErrorCode.GENERIC_ERROR
}

/**
 * Create a user-friendly error message from error code
 */
export function formatCaptchaError(code: CaptchaErrorCode, includeDetails = false): string {
  const error = getCaptchaError(code)
  let message = error.userMessage
  
  if (includeDetails && error.suggestion) {
    message += ` ${error.suggestion}`
  }
  
  return message
}

/**
 * Create an error response object for API
 */
export function createCaptchaErrorResponse(code: CaptchaErrorCode, includeDetails = false) {
  const error = getCaptchaError(code)
  
  return {
    error: error.message,
    errorCode: code,
    userMessage: error.userMessage,
    ...(includeDetails && {
      suggestion: error.suggestion,
      technicalDetails: error.technicalDetails,
    }),
  }
}
