import { NextRequest } from "next/server"
import { getClientIp } from "./getClientIp"

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limiting
// In production, consider using Redis or similar for distributed systems
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 10 * 60 * 1000)

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number
  /**
   * Time window in seconds
   */
  windowSeconds: number
  /**
   * Optional prefix for the rate limit key
   */
  keyPrefix?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  error?: string
}

/**
 * Check if a request should be rate limited
 * 
 * @param request - The NextRequest object
 * @param options - Rate limit configuration
 * @returns Rate limit result with success status and headers info
 * 
 * @example
 * ```typescript
 * const rateLimitResult = checkRateLimit(request, {
 *   maxRequests: 5,
 *   windowSeconds: 60,
 *   keyPrefix: 'register'
 * })
 * 
 * if (!rateLimitResult.success) {
 *   return NextResponse.json(
 *     { error: rateLimitResult.error },
 *     { status: 429 }
 *   )
 * }
 * ```
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): RateLimitResult {
  const { maxRequests, windowSeconds, keyPrefix = "ratelimit" } = options

  // Get client identifier (IP address)
  const clientIp = getClientIp(request)
  const key = `${keyPrefix}:${clientIp}`

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const resetAt = now + windowMs

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 1,
      resetAt,
    }
    rateLimitStore.set(key, entry)

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Math.floor(resetAt / 1000),
    }
  }

  // Increment count
  entry.count++

  if (entry.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: Math.floor(entry.resetAt / 1000),
      error: `Too many requests. Please try again after ${Math.ceil((entry.resetAt - now) / 1000)} seconds.`,
    }
  }

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: Math.floor(entry.resetAt / 1000),
  }
}

/**
 * Extract rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  }
}

/**
 * Reset rate limit for a specific IP and key prefix
 * Useful for testing or admin overrides
 */
export function resetRateLimit(ip: string, keyPrefix: string): void {
  const key = `${keyPrefix}:${ip}`
  rateLimitStore.delete(key)
}

/**
 * Clear all rate limit entries
 * Useful for tests or maintenance
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear()
}
