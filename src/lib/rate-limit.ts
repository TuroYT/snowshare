interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to prevent memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  },
  5 * 60 * 1000
);

/**
 * Returns true when the caller has exceeded the rate limit for the given key.
 *
 * @param key       Unique string identifying the subject (e.g. "pwd:${slug}:${ip}")
 * @param limit     Maximum number of requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) return true;

  entry.count += 1;
  return false;
}
