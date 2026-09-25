/**
 * @jest-environment node
 */

import {
  consumeRateLimit,
  getRetryAfter,
  recordRateLimitHit,
  resetRateLimit,
  RATE_LIMITS,
} from "@/lib/rate-limit";

describe("rate limiter", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it("allows events until the limit, then reports a retry delay", () => {
    const { limit } = RATE_LIMITS.sharePassword;
    for (let i = 0; i < limit; i++) {
      expect(getRetryAfter("sharePassword", "ip:share")).toBe(0);
      recordRateLimitHit("sharePassword", "ip:share");
    }
    expect(getRetryAfter("sharePassword", "ip:share")).toBeGreaterThan(0);
  });

  it("keeps keys and scopes independent", () => {
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) recordRateLimitHit("login", "a");

    expect(getRetryAfter("login", "a")).toBeGreaterThan(0);
    expect(getRetryAfter("login", "b")).toBe(0);
    expect(getRetryAfter("register", "a")).toBe(0);
  });

  it("resets a key", () => {
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) recordRateLimitHit("login", "k");
    resetRateLimit("login", "k");

    expect(getRetryAfter("login", "k")).toBe(0);
  });

  it("frees the key once the window has elapsed", () => {
    jest.useFakeTimers();
    for (let i = 0; i < RATE_LIMITS.apiKey.limit; i++) recordRateLimitHit("apiKey", "ip");
    expect(getRetryAfter("apiKey", "ip")).toBeGreaterThan(0);

    jest.advanceTimersByTime(RATE_LIMITS.apiKey.windowMs + 1);

    expect(getRetryAfter("apiKey", "ip")).toBe(0);
  });

  it("consumeRateLimit counts the event and refuses past the limit", () => {
    const { limit } = RATE_LIMITS.register;
    for (let i = 0; i < limit; i++) expect(consumeRateLimit("register", "ip")).toBe(0);
    expect(consumeRateLimit("register", "ip")).toBeGreaterThan(0);
  });
});
