import { prisma } from "./prisma"

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
async function validateRecaptcha(token: string, secretKey: string): Promise<CaptchaValidationResult> {
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    const data = await response.json()

    if (data.success) {
      return { success: true }
    } else {
      return {
        success: false,
        error: "CAPTCHA validation failed. Please try again.",
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
async function validateTurnstile(token: string, secretKey: string): Promise<CaptchaValidationResult> {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    })

    const data = await response.json()

    if (data.success) {
      return { success: true }
    } else {
      return {
        success: false,
        error: "CAPTCHA validation failed. Please try again.",
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
 */
export async function validateCaptcha(token: string | null | undefined): Promise<CaptchaValidationResult> {
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

  // Validate based on provider
  switch (config.provider) {
    case "recaptcha-v2":
    case "recaptcha-v3":
      return validateRecaptcha(token, config.secretKey)
    case "turnstile":
      return validateTurnstile(token, config.secretKey)
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
