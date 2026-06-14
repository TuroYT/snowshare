interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000).unref?.();

/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 * Uses a fixed-window counter keyed by `key`.
 *
 * @param key         Unique key (e.g. "register:1.2.3.4")
 * @param maxRequests Maximum allowed requests per window
 * @param windowMs    Window duration in milliseconds
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/** Exposed for testing only — removes the entry for a key. */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
