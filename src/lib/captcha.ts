import { prisma } from "./prisma"
import { getClientIp } from "./getClientIp"
import { NextRequest } from "next/server"

export interface CaptchaValidationResult {
  success: boolean
  error?: string
}

/**
 * Get CAPTCHA configuration from database settings
 */
async function getCaptchaConfig() {
  const settings = await prisma.settings.findFirst()
  
  if (!settings?.captchaEnabled) {
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
      // Provide more detailed error messages
      const errorCodes = data["error-codes"] || []
      let errorMessage = "CAPTCHA validation failed. Please try again."

      if (errorCodes.includes("timeout-or-duplicate")) {
        errorMessage = "CAPTCHA has expired or was already used. Please try again."
      } else if (errorCodes.includes("invalid-input-response")) {
        errorMessage = "Invalid CAPTCHA response. Please try again."
      } else if (errorCodes.includes("invalid-input-secret")) {
        errorMessage = "CAPTCHA configuration error. Please contact the administrator."
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  } catch (error) {
    console.error("reCAPTCHA validation error:", error)
    return {
      success: false,
      error: "CAPTCHA validation error. Please try again.",
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
      // Provide more detailed error messages
      const errorCodes = data["error-codes"] || []
      let errorMessage = "CAPTCHA validation failed. Please try again."

      if (errorCodes.includes("timeout-or-duplicate")) {
        errorMessage = "CAPTCHA has expired or was already used. Please refresh the page and try again."
      } else if (errorCodes.includes("invalid-input-response")) {
        errorMessage = "Invalid CAPTCHA response. Please try again."
      } else if (errorCodes.includes("invalid-input-secret")) {
        errorMessage = "CAPTCHA configuration error. Please contact the administrator."
      } else if (errorCodes.includes("bad-request")) {
        errorMessage = "Invalid CAPTCHA request. Please try again."
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  } catch (error) {
    console.error("Turnstile validation error:", error)
    return {
      success: false,
      error: "CAPTCHA validation error. Please try again.",
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

  // If CAPTCHA is enabled but no token provided
  if (!token) {
    return {
      success: false,
      error: "CAPTCHA verification is required.",
    }
  }

  // Extract IP and hostname if request provided
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

  // Validate based on provider
  switch (config.provider) {
    case "recaptcha-v2":
    case "recaptcha-v3":
      return validateRecaptcha(token, config.secretKey, ip)
    case "turnstile":
      return validateTurnstile(token, config.secretKey, ip, hostname)
    default:
      return {
        success: false,
        error: "Unknown CAPTCHA provider.",
      }
  }
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
