/**
 * @jest-environment node
 */

jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/providers", () => ({ providerMap: {} }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

import { crossSiteCookies } from "@/lib/auth";

describe("crossSiteCookies (iframe embedding)", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  afterEach(() => {
    process.env.NEXTAUTH_URL = originalUrl;
  });

  it("keeps next-auth's secure default names on https, read by getServerSession and getToken", () => {
    process.env.NEXTAUTH_URL = "https://share.example.com";
    const cookies = crossSiteCookies();

    expect(cookies.sessionToken?.name).toBe("__Secure-next-auth.session-token");
    expect(cookies.callbackUrl?.name).toBe("__Secure-next-auth.callback-url");
    expect(cookies.csrfToken?.name).toBe("__Host-next-auth.csrf-token");
    expect(cookies.sessionToken?.options).toMatchObject({ sameSite: "none", secure: true });
  });

  it("uses the unprefixed default names when NEXTAUTH_URL is http", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const cookies = crossSiteCookies();

    expect(cookies.sessionToken?.name).toBe("next-auth.session-token");
    expect(cookies.csrfToken?.name).toBe("next-auth.csrf-token");
  });
});
