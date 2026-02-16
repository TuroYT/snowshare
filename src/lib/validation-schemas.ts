/**
 * Validation schemas using Zod for API input validation
 * These schemas ensure type safety and prevent invalid data from reaching the database
 */

import { z } from "zod"

/**
 * Email validation
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .max(255, "Email too long")

/**
 * Password validation with security requirements
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")

/**
 * CAPTCHA token validation
 */
export const captchaTokenSchema = z
  .string()
  .min(1, "CAPTCHA token is required")
  .max(10000, "CAPTCHA token too long")
  .optional()

/**
 * Registration request schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  captchaToken: captchaTokenSchema,
  isFirstUser: z.boolean().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * SMTP configuration schema
 */
export const smtpConfigSchema = z.object({
  smtpHost: z.string().min(1).max(255).nullable(),
  smtpPort: z.number().int().min(1).max(65535).nullable(),
  smtpSecure: z.boolean(),
  smtpUser: z.string().min(1).max(255).nullable(),
  smtpPassword: z.string().min(1).max(255).nullable(),
  smtpFromEmail: emailSchema.nullable(),
  smtpFromName: z.string().min(1).max(100).nullable(),
})

/**
 * CAPTCHA provider types
 */
export const captchaProviderSchema = z.enum([
  "recaptcha-v2",
  "recaptcha-v3",
  "turnstile",
])

/**
 * CAPTCHA configuration schema
 */
export const captchaConfigSchema = z.object({
  captchaEnabled: z.boolean(),
  captchaProvider: captchaProviderSchema.nullable(),
  captchaSiteKey: z.string().min(1).max(500).nullable(),
  captchaSecretKey: z.string().min(1).max(500).nullable(),
})

/**
 * Security settings update schema
 */
export const securitySettingsSchema = z
  .object({
    requireEmailVerification: z.boolean(),
    smtpHost: z.string().min(1).max(255).nullable(),
    smtpPort: z.number().int().min(1).max(65535).nullable(),
    smtpSecure: z.boolean(),
    smtpUser: z.string().min(1).max(255).nullable(),
    smtpPassword: z.string().min(1).max(255).nullable(),
    smtpFromEmail: emailSchema.nullable(),
    smtpFromName: z.string().min(1).max(100).nullable(),
    captchaEnabled: z.boolean(),
    captchaProvider: captchaProviderSchema.nullable(),
    captchaSiteKey: z.string().min(1).max(500).nullable(),
    captchaSecretKey: z.string().min(1).max(500).nullable(),
  })
  .refine(
    (data) => {
      // If email verification is enabled, SMTP must be configured
      if (data.requireEmailVerification) {
        return !!(data.smtpHost && data.smtpPort && data.smtpFromEmail)
      }
      return true
    },
    {
      message: "SMTP configuration is required when email verification is enabled",
      path: ["smtpHost"],
    }
  )
  .refine(
    (data) => {
      // If CAPTCHA is enabled, provider and keys must be configured
      if (data.captchaEnabled) {
        return !!(data.captchaProvider && data.captchaSiteKey && data.captchaSecretKey)
      }
      return true
    },
    {
      message: "CAPTCHA provider and keys are required when CAPTCHA is enabled",
      path: ["captchaProvider"],
    }
  )

export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>

/**
 * Test CAPTCHA request schema
 */
export const testCaptchaSchema = z.object({
  provider: captchaProviderSchema,
  siteKey: z.string().min(1, "Site key is required").max(500),
  secretKey: z.string().min(1, "Secret key is required").max(500),
})

export type TestCaptchaInput = z.infer<typeof testCaptchaSchema>

/**
 * Test email request schema
 */
export const testEmailSchema = z.object({
  email: emailSchema,
})

export type TestEmailInput = z.infer<typeof testEmailSchema>

/**
 * Share creation schemas
 */

export const fileShareSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  expiresAt: z.string().datetime().optional(),
  password: z.string().min(1).max(128).optional(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,30}$/, "Slug must be 3-30 alphanumeric characters, hyphens, or underscores")
    .optional(),
})

export const linkShareSchema = z.object({
  url: z.string().url("Invalid URL format").max(2048),
  expiresAt: z.string().datetime().optional(),
  password: z.string().min(1).max(128).optional(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,30}$/, "Slug must be 3-30 alphanumeric characters, hyphens, or underscores")
    .optional(),
})

export const pasteShareSchema = z.object({
  content: z.string().min(1, "Content is required").max(1000000, "Content too large"),
  language: z.string().min(1).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
  password: z.string().min(1).max(128).optional(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,30}$/, "Slug must be 3-30 alphanumeric characters, hyphens, or underscores")
    .optional(),
})

/**
 * Helper function to safely parse and validate input
 * Returns parsed data or throws ZodError with details
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Helper function to safely parse with error handling
 * Returns { success: true, data } or { success: false, errors }
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}
