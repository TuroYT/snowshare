/**
 * Tests for getClientIp utility (getClientIp.ts)
 */

import { getClientIp } from "@/lib/getClientIp";
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

    it("should return the first IP when multiple IPs are present", () => {
      const request = makeRequest({
        "x-forwarded-for": "203.0.113.1, 10.0.0.1, 172.16.0.1",
      });
      expect(getClientIp(request)).toBe("203.0.113.1");
    });

    it("should trim whitespace from the IP", () => {
      const request = makeRequest({ "x-forwarded-for": "  203.0.113.1  , 10.0.0.1" });
      expect(getClientIp(request)).toBe("203.0.113.1");
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
    it("should handle IPv6 addresses in x-forwarded-for", () => {
      const request = makeRequest({ "x-forwarded-for": "::1" });
      expect(getClientIp(request)).toBe("::1");
    });

    it("should handle full IPv6 addresses", () => {
      const request = makeRequest({ "x-forwarded-for": "2001:db8::1" });
      expect(getClientIp(request)).toBe("2001:db8::1");
    });
  });
});
