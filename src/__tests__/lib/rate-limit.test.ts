import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const key = "test:127.0.0.1";

  afterEach(() => resetRateLimit(key));

  it("allows requests under the limit", () => {
    expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    expect(checkRateLimit(key, 5, 60_000)).toBe(true);
  });

  it("blocks the (maxRequests + 1)th request", () => {
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    resetRateLimit(key);
    expect(checkRateLimit(key, 5, 60_000)).toBe(true);
  });
});
