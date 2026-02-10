/**
 * Environment variable validation utility
 * Validates required and optional environment variables at application startup
 * Helps prevent runtime errors due to misconfiguration
 */

import { z } from "zod"

/**
 * Environment variable schema
 * Defines all expected environment variables with their types and validation rules
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL connection string"),

  // NextAuth
  NEXTAUTH_URL: z
    .string()
    .min(1, "NEXTAUTH_URL is required")
    .url("NEXTAUTH_URL must be a valid URL")
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      "NEXTAUTH_URL must start with http:// or https://"
    ),

  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters for security")
    .refine(
      (secret) => !/^(secret|changeme|password|test)/i.test(secret),
      "NEXTAUTH_SECRET should not use common/weak values"
    ),

  // Optional: Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),

  // Optional: Port
  PORT: z
    .string()
    .optional()
    .default("3000")
    .refine((port) => {
      const num = parseInt(port, 10)
      return !isNaN(num) && num > 0 && num < 65536
    }, "PORT must be a valid port number (1-65535)"),

  // Optional: Signup control
  ALLOW_SIGNUP: z
    .string()
    .optional()
    .default("true")
    .refine((val) => ["true", "false", "1", "0"].includes(val.toLowerCase()), "ALLOW_SIGNUP must be true/false or 1/0"),
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * Validate environment variables
 * Should be called at application startup (e.g., in server.js or middleware)
 * 
 * @param throwOnError - If true, throws on validation errors; if false, returns result
 * @returns Validation result with parsed config or errors
 * 
 * @example
 * ```typescript
 * // In server.js or startup file
 * const envResult = validateEnv()
 * if (!envResult.success) {
 *   console.error("Environment validation failed:", envResult.errors)
 *   process.exit(1)
 * }
 * ```
 */
export function validateEnv(throwOnError = false): 
  | { success: true; config: EnvConfig }
  | { success: false; errors: z.ZodError } {
  
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    ALLOW_SIGNUP: process.env.ALLOW_SIGNUP,
  }

  const result = envSchema.safeParse(env)

  if (!result.success) {
    if (throwOnError) {
      throw new Error(
        `Environment validation failed:\n${result.error.issues
          .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
          .join("\n")}`
      )
    }
    return { success: false, errors: result.error }
  }

  return { success: true, config: result.data }
}

/**
 * Get validated environment config
 * Throws if validation fails - use at startup only
 */
export function getEnvConfig(): EnvConfig {
  const result = validateEnv(true)
  if (!result.success) {
    // TypeScript knows this won't happen due to throwOnError=true
    throw new Error("Environment validation failed")
  }
  return result.config
}

/**
 * Check if specific environment variables are set
 * Useful for optional feature flags
 */
export function hasEnvVar(name: string): boolean {
  return !!process.env[name]
}

/**
 * Get environment variable with default fallback
 * Type-safe alternative to process.env with defaults
 */
export function getEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

/**
 * Validate environment at module load for critical errors
 * This runs immediately when imported
 */
if (process.env.NODE_ENV !== "test") {
  const result = validateEnv()
  if (!result.success) {
    console.warn("⚠️  Environment validation warnings detected:")
    result.errors.issues.forEach((issue) => {
      console.warn(`   - ${issue.path.join(".")}: ${issue.message}`)
    })
    console.warn("⚠️  Application may not function correctly. Please check your .env file.\n")
  }
}

/**
 * Format environment errors for logging
 */
export function formatEnvErrors(errors: z.ZodError): string[] {
  return errors.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
}

/**
 * Redact sensitive environment values for logging
 * Masks secrets while showing structure
 */
export function redactEnvForLogging(env: Record<string, string | undefined>): Record<string, string> {
  const redacted: Record<string, string> = {}
  const sensitiveKeys = ["secret", "password", "key", "token", "auth"]

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      redacted[key] = "(not set)"
      continue
    }

    const isSensitive = sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
    
    if (isSensitive) {
      redacted[key] = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "****"
    } else {
      redacted[key] = value
    }
  }

  return redacted
}
