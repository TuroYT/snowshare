/**
 * @jest-environment node
 */

import type { NextRequest } from "next/server";
import { isCrossSiteMutation } from "@/proxy";

function makeRequest(
  method: string,
  headers: Record<string, string>,
  pathname = "/api/user/profile"
): NextRequest {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    nextUrl: { pathname },
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

const COOKIE = { cookie: "next-auth.session-token=abc", host: "share.example.com" };

describe("isCrossSiteMutation", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  afterEach(() => {
    process.env.NEXTAUTH_URL = originalUrl;
  });

  it("rejects a cross-site POST carrying cookies", () => {
    expect(
      isCrossSiteMutation(makeRequest("POST", { ...COOKIE, "sec-fetch-site": "cross-site" }))
    ).toBe(true);
  });

  it("allows same-origin and same-site requests", () => {
    expect(
      isCrossSiteMutation(makeRequest("PATCH", { ...COOKIE, "sec-fetch-site": "same-origin" }))
    ).toBe(false);
    expect(
      isCrossSiteMutation(makeRequest("DELETE", { ...COOKIE, "sec-fetch-site": "same-site" }))
    ).toBe(false);
  });

  it("ignores safe methods", () => {
    expect(
      isCrossSiteMutation(makeRequest("GET", { ...COOKIE, "sec-fetch-site": "cross-site" }))
    ).toBe(false);
  });

  it("ignores requests without cookies or authenticated by an Authorization header", () => {
    expect(isCrossSiteMutation(makeRequest("POST", { "sec-fetch-site": "cross-site" }))).toBe(
      false
    );
    expect(
      isCrossSiteMutation(
        makeRequest("POST", {
          ...COOKIE,
          "sec-fetch-site": "cross-site",
          authorization: "Bearer sk_x",
        })
      )
    ).toBe(false);
  });

  it("leaves NextAuth endpoints to their own CSRF protection", () => {
    expect(
      isCrossSiteMutation(
        makeRequest("POST", { ...COOKIE, "sec-fetch-site": "cross-site" }, "/api/auth/callback/x")
      )
    ).toBe(false);
  });

  describe("without Fetch Metadata", () => {
    it("rejects a foreign or null Origin", () => {
      expect(
        isCrossSiteMutation(makeRequest("POST", { ...COOKIE, origin: "https://evil.test" }))
      ).toBe(true);
      expect(isCrossSiteMutation(makeRequest("POST", { ...COOKIE, origin: "null" }))).toBe(true);
    });

    it("accepts the Host, X-Forwarded-Host or NEXTAUTH_URL origin", () => {
      expect(
        isCrossSiteMutation(makeRequest("POST", { ...COOKIE, origin: "https://share.example.com" }))
      ).toBe(false);
      expect(
        isCrossSiteMutation(
          makeRequest("POST", {
            cookie: COOKIE.cookie,
            host: "localhost:3000",
            "x-forwarded-host": "public.example.com",
            origin: "https://public.example.com",
          })
        )
      ).toBe(false);
      process.env.NEXTAUTH_URL = "https://files.example.com";
      expect(
        isCrossSiteMutation(
          makeRequest("POST", {
            cookie: COOKIE.cookie,
            host: "localhost:3000",
            origin: "https://files.example.com",
          })
        )
      ).toBe(false);
    });

    it("accepts a request without Origin", () => {
      expect(isCrossSiteMutation(makeRequest("POST", COOKIE))).toBe(false);
    });
  });
});
