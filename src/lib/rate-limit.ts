import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCode, type ApiErrorResponse } from "@/lib/api-errors";

/**
 * In-memory fixed-window rate limiter.
 *
 * State lives in the Node.js process (single-instance deployments). The store is kept on
 * globalThis so every bundle/module instance in the process shares the same counters, and is
 * bounded so a flood of distinct keys (e.g. spoofed IPs) cannot grow memory without limit.
 */

export interface RateLimitRule {
  /** Maximum number of counted events per window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

export const RATE_LIMITS = {
  /** Wrong passwords on a single password-protected share, per IP */
  sharePassword: { limit: 10, windowMs: 5 * 60 * 1000 },
  /** Failed credential logins, per IP + email */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Account registrations, per IP */
  register: { limit: 10, windowMs: 60 * 60 * 1000 },
  /** Share notification emails sent, per user */
  sendEmail: { limit: 30, windowMs: 60 * 60 * 1000 },
  /** Invalid API keys presented, per IP */
  apiKey: { limit: 30, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_ENTRIES = 50_000;

const globalForRateLimit = globalThis as unknown as { __snowshareRateLimit?: Map<string, Bucket> };
const store = (globalForRateLimit.__snowshareRateLimit ??= new Map<string, Bucket>());

function getBucket(scope: RateLimitScope, key: string, now: number): Bucket | undefined {
  const id = `${scope}:${key}`;
  const bucket = store.get(id);
  if (bucket && bucket.resetAt <= now) {
    store.delete(id);
    return undefined;
  }
  return bucket;
}

function evictIfFull(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [id, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(id);
  }
  // Still full: drop the oldest insertions (Map preserves insertion order)
  const excess = store.size - MAX_ENTRIES + 1;
  if (excess > 0) {
    let removed = 0;
    for (const id of store.keys()) {
      store.delete(id);
      if (++removed >= excess) break;
    }
  }
}

/**
 * Returns the number of seconds until the key may try again, or 0 when not limited.
 * Does not count an event.
 */
export function getRetryAfter(scope: RateLimitScope, key: string): number {
  const now = Date.now();
  const bucket = getBucket(scope, key, now);
  if (!bucket || bucket.count < RATE_LIMITS[scope].limit) return 0;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

/**
 * Number of events still allowed for the key in the current window.
 */
export function getRemainingEvents(scope: RateLimitScope, key: string): number {
  const bucket = getBucket(scope, key, Date.now());
  return Math.max(0, RATE_LIMITS[scope].limit - (bucket?.count ?? 0));
}

/**
 * Counts one event for the key (e.g. a failed password attempt).
 */
export function recordRateLimitHit(scope: RateLimitScope, key: string): void {
  const now = Date.now();
  const bucket = getBucket(scope, key, now);
  if (bucket) {
    bucket.count += 1;
    return;
  }
  evictIfFull(now);
  store.set(`${scope}:${key}`, { count: 1, resetAt: now + RATE_LIMITS[scope].windowMs });
}

/**
 * Counts one event and returns the retry delay in seconds when the limit is now exceeded,
 * or 0 when the event is allowed. Use for actions that are limited regardless of outcome.
 */
export function consumeRateLimit(scope: RateLimitScope, key: string): number {
  const retryAfter = getRetryAfter(scope, key);
  if (retryAfter > 0) return retryAfter;
  recordRateLimitHit(scope, key);
  return 0;
}

/**
 * Clears the counter for a key (e.g. after a successful login).
 */
export function resetRateLimit(scope: RateLimitScope, key: string): void {
  store.delete(`${scope}:${key}`);
}

/**
 * Translated 429 response with a Retry-After header.
 */
export function rateLimitResponse(
  request: NextRequest,
  retryAfterSeconds: number
): NextResponse<ApiErrorResponse> {
  const response = apiError(request, ErrorCode.TOO_MANY_REQUESTS, {
    seconds: retryAfterSeconds,
  });
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/** Test helper: clears every counter. */
export function __resetAllRateLimits(): void {
  store.clear();
}
