/**
 * Tests for getClientIp utility (getClientIp.ts)
 */

import { getClientIp, resolveClientIp } from "@/lib/getClientIp";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("getClientIp", () => {
  describe("x-forwarded-for header", () => {
    it("should return the first IP from x-forwarded-for", () => {
      const request = makeRequest({ "x-forwarded-for": "203.0.113.1" });
      expect(getClientIp(request)).toBe("203.0.113.1");
    });

    it("should return the last IP (appended by the trusted proxy) when multiple IPs are present", () => {
      const request = makeRequest({
        "x-forwarded-for": "203.0.113.1, 10.0.0.1, 172.16.0.1",
      });
      expect(getClientIp(request)).toBe("172.16.0.1");
    });

    it("should ignore a client-forged leftmost entry", () => {
      const request = makeRequest({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" });
      expect(getClientIp(request)).toBe("198.51.100.7");
    });

    it("should trim whitespace from the IP", () => {
      const request = makeRequest({ "x-forwarded-for": "10.0.0.1,   203.0.113.1  " });
      expect(getClientIp(request)).toBe("203.0.113.1");
    });

    it("should fall back to x-real-ip when the selected entry is not a valid IP", () => {
      const request = makeRequest({
        "x-forwarded-for": "not-an-ip",
        "x-real-ip": "198.51.100.1",
      });
      expect(getClientIp(request)).toBe("198.51.100.1");
    });

    it("should prefer x-forwarded-for over x-real-ip", () => {
      const request = makeRequest({
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "198.51.100.1",
      });
      expect(getClientIp(request)).toBe("203.0.113.1");
    });
  });

  describe("x-real-ip header", () => {
    it("should return x-real-ip when x-forwarded-for is absent", () => {
      const request = makeRequest({ "x-real-ip": "198.51.100.1" });
      expect(getClientIp(request)).toBe("198.51.100.1");
    });

    it("should trim whitespace from x-real-ip", () => {
      const request = makeRequest({ "x-real-ip": "  198.51.100.1  " });
      expect(getClientIp(request)).toBe("198.51.100.1");
    });
  });

  describe("fallback", () => {
    it("should return 127.0.0.1 when no proxy headers are present", () => {
      const request = makeRequest({});
      expect(getClientIp(request)).toBe("127.0.0.1");
    });

    it("should return 127.0.0.1 when headers are null", () => {
      const request = {
        headers: {
          get: () => null,
        },
      } as unknown as NextRequest;
      expect(getClientIp(request)).toBe("127.0.0.1");
    });
  });

  describe("IPv6 addresses", () => {
    it("should normalize IPv6 localhost to 127.0.0.1", () => {
      const request = makeRequest({ "x-forwarded-for": "::1" });
      expect(getClientIp(request)).toBe("127.0.0.1");
    });

    it("should unwrap IPv4-mapped IPv6 addresses", () => {
      const request = makeRequest({ "x-forwarded-for": "::ffff:203.0.113.9" });
      expect(getClientIp(request)).toBe("203.0.113.9");
    });

    it("should handle full IPv6 addresses", () => {
      const request = makeRequest({ "x-forwarded-for": "2001:db8::1" });
      expect(getClientIp(request)).toBe("2001:db8::1");
    });
  });
});

describe("resolveClientIp with TRUSTED_PROXY_COUNT", () => {
  const original = process.env.TRUSTED_PROXY_COUNT;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_PROXY_COUNT;
    else process.env.TRUSTED_PROXY_COUNT = original;
  });

  it("should read the N-th entry from the right", () => {
    process.env.TRUSTED_PROXY_COUNT = "2";
    expect(resolveClientIp({ forwardedFor: "1.2.3.4, 203.0.113.5, 10.0.0.2" })).toBe("203.0.113.5");
  });

  it("should clamp to the leftmost entry when there are fewer hops than proxies", () => {
    process.env.TRUSTED_PROXY_COUNT = "5";
    expect(resolveClientIp({ forwardedFor: "203.0.113.5, 10.0.0.2" })).toBe("203.0.113.5");
  });

  it("should ignore invalid values and default to 1", () => {
    process.env.TRUSTED_PROXY_COUNT = "abc";
    expect(resolveClientIp({ forwardedFor: "1.2.3.4, 203.0.113.5" })).toBe("203.0.113.5");
  });

  it("should use the socket address when no header is present", () => {
    expect(resolveClientIp({ remoteAddress: "::ffff:192.0.2.10" })).toBe("192.0.2.10");
  });

  it("should ignore forwarding headers when TRUSTED_PROXY_COUNT is 0", () => {
    process.env.TRUSTED_PROXY_COUNT = "0";
    expect(
      resolveClientIp({ forwardedFor: "1.2.3.4", realIp: "5.6.7.8", remoteAddress: "192.0.2.1" })
    ).toBe("192.0.2.1");
  });
});

describe("getClientIp with the custom server header", () => {
  it("should prefer the IP resolved by server.js", () => {
    const request = makeRequest({
      "x-snowshare-client-ip": "192.0.2.50",
      "x-forwarded-for": "1.2.3.4",
    });
    expect(getClientIp(request)).toBe("192.0.2.50");
  });
});
