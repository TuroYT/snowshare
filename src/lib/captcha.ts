import { prisma } from "./prisma"
import { getClientIp } from "./getClientIp"
import { NextRequest } from "next/server"
import { mapProviderErrorCode, CaptchaErrorCode, getCaptchaError } from "./captcha-errors"
import { logCaptchaValidationFailed, logSecurityEvent, SecurityEventType, SecurityEventSeverity } from "./security-logger"

export interface CaptchaValidationResult {
  success: boolean
  error?: string
  errorCode?: CaptchaErrorCode
  userMessage?: string
}

/**
 * Get CAPTCHA configuration from database settings
 */
async function getCaptchaConfig() {
  const settings = await prisma.settings.findFirst()
  
  if (!settings?.captchaEnabled) {
    logSecurityEvent({
      type: SecurityEventType.CAPTCHA_VALIDATION_SUCCESS,
      severity: SecurityEventSeverity.INFO,
      message: "CAPTCHA validation bypassed - CAPTCHA not enabled",
    })
    return null
  }

  if (!settings.captchaProvider || !settings.captchaSiteKey || !settings.captchaSecretKey) {
    throw new Error("CAPTCHA configuration incomplete. Please configure CAPTCHA in admin settings.")
  }

  return {
    enabled: settings.captchaEnabled,
    provider: settings.captchaProvider,
    siteKey: settings.captchaSiteKey,
    secretKey: settings.captchaSecretKey,
  }
}

/**
 * Validate Google reCAPTCHA v2/v3 response
 */
async function validateRecaptcha(
  token: string, 
  secretKey: string,
  ip?: string
): Promise<CaptchaValidationResult> {
  try {
    let body = `secret=${secretKey}&response=${token}`
    if (ip) {
      body += `&remoteip=${ip}`
    }

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })

    const data = await response.json()

    if (data.success) {
      return { success: true }
    } else {
      // Map provider error codes to internal codes
      const errorCodes = data["error-codes"] || []
      const providerErrorCode = errorCodes[0] || "generic_error"
      const internalCode = mapProviderErrorCode("recaptcha-v2", providerErrorCode)
      const errorDetails = getCaptchaError(internalCode)

      return {
        success: false,
        error: errorDetails.message,
        errorCode: internalCode,
        userMessage: errorDetails.userMessage,
      }
    }
  } catch (error) {
    console.error("reCAPTCHA validation error:", error)
    const errorDetails = getCaptchaError(CaptchaErrorCode.NETWORK_ERROR)
    return {
      success: false,
      error: errorDetails.message,
      errorCode: CaptchaErrorCode.NETWORK_ERROR,
      userMessage: errorDetails.userMessage,
    }
  }
}

/**
 * Validate Cloudflare Turnstile response
 */
async function validateTurnstile(
  token: string, 
  secretKey: string,
  ip?: string,
  hostname?: string
): Promise<CaptchaValidationResult> {
  try {
    const body: {
      secret: string
      response: string
      remoteip?: string
      hostname?: string
    } = {
      secret: secretKey,
      response: token,
    }

    // Include IP and hostname for better security
    if (ip) {
      body.remoteip = ip
    }
    if (hostname) {
      body.hostname = hostname
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (data.success) {
      return { success: true }
    } else {
      // Map provider error codes to internal codes
      const errorCodes = data["error-codes"] || []
      const providerErrorCode = errorCodes[0] || "generic_error"
      const internalCode = mapProviderErrorCode("turnstile", providerErrorCode)
      const errorDetails = getCaptchaError(internalCode)

      return {
        success: false,
        error: errorDetails.message,
        errorCode: internalCode,
        userMessage: errorDetails.userMessage,
      }
    }
  } catch (error) {
    console.error("Turnstile validation error:", error)
    const errorDetails = getCaptchaError(CaptchaErrorCode.NETWORK_ERROR)
    return {
      success: false,
      error: errorDetails.message,
      errorCode: CaptchaErrorCode.NETWORK_ERROR,
      userMessage: errorDetails.userMessage,
    }
  }
}

/**
 * Validate CAPTCHA token based on configured provider
 * @param token - CAPTCHA token from client
 * @param request - Optional request object to extract IP and hostname
 */
export async function validateCaptcha(
  token: string | null | undefined,
  request?: NextRequest
): Promise<CaptchaValidationResult> {
  const config = await getCaptchaConfig()

  // If CAPTCHA is not enabled, validation passes
  if (!config) {
    return { success: true }
  }

  // Extract IP and hostname early for logging
  let ip: string | undefined
  let hostname: string | undefined

  if (request) {
    try {
      ip = getClientIp(request)
      const url = new URL(request.url)
      hostname = url.hostname
    } catch (error) {
      console.error("Error extracting request metadata:", error)
    }
  }

  // If CAPTCHA is enabled but no token provided
  if (!token) {
    const errorDetails = getCaptchaError(CaptchaErrorCode.TOKEN_MISSING)
    
    if (ip) {
      logCaptchaValidationFailed(ip, config.provider, "token_missing")
    }
    
    return {
      success: false,
      error: errorDetails.message,
      errorCode: CaptchaErrorCode.TOKEN_MISSING,
      userMessage: errorDetails.userMessage,
    }
  }

  // Validate based on provider
  let result: CaptchaValidationResult
  
  switch (config.provider) {
    case "recaptcha-v2":
    case "recaptcha-v3":
      result = await validateRecaptcha(token, config.secretKey, ip)
      break
    case "turnstile":
      result = await validateTurnstile(token, config.secretKey, ip, hostname)
      break
    default: {
      const errorDetails = getCaptchaError(CaptchaErrorCode.UNKNOWN_PROVIDER)
      result = {
        success: false,
        error: errorDetails.message,
        errorCode: CaptchaErrorCode.UNKNOWN_PROVIDER,
        userMessage: errorDetails.userMessage,
      }
      break
    }
  }

  // Log validation failures
  if (!result.success && ip) {
    logCaptchaValidationFailed(ip, config.provider, result.errorCode || "unknown")
  } else if (result.success) {
    logSecurityEvent({
      type: SecurityEventType.CAPTCHA_VALIDATION_SUCCESS,
      severity: SecurityEventSeverity.INFO,
      message: `CAPTCHA validation successful (${config.provider})`,
      ip,
    })
  }

  return result
}

/**
 * Get public CAPTCHA configuration for client-side widget
 */
export async function getPublicCaptchaConfig() {
  const settings = await prisma.settings.findFirst()
  
  if (!settings?.captchaEnabled) {
    return {
      enabled: false,
      provider: null,
      siteKey: null,
    }
  }

  return {
    enabled: settings.captchaEnabled,
    provider: settings.captchaProvider,
    siteKey: settings.captchaSiteKey,
  }
}
