import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { apiError, ErrorCode } from "@/lib/api-errors";

const SCALAR_DOMAINS =
  "https://api.scalar.com https://cdn.scalar.com https://fonts.scalar.com https://cdn.jsdelivr.net";

// Helper function to add security headers
function addSecurityHeaders(
  response: NextResponse,
  _isApiDocs = false,
  isScalarHtml = false,
  allowIframeEmbedding = false
): NextResponse {
  // Prevent clickjacking — omit when iframe embedding is allowed by admin
  if (!allowIframeEmbedding) {
    response.headers.set("X-Frame-Options", isScalarHtml ? "SAMEORIGIN" : "DENY");
  }
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Enable browser XSS protection
  response.headers.set("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Comprehensive permissions policy restricting potentially dangerous APIs
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()"
  );
  // HSTS
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  let frameAncestors: string;
  if (allowIframeEmbedding) {
    frameAncestors = "frame-ancestors *";
  } else if (isScalarHtml) {
    frameAncestors = "frame-ancestors 'self'";
  } else {
    frameAncestors = "frame-ancestors 'none'";
  }

  // Content Security Policy
  const scalarScriptSrc = isScalarHtml ? " https://cdn.jsdelivr.net" : "";
  const scalarDomains = isScalarHtml ? " " + SCALAR_DOMAINS : "";
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://stats.sheephost.fr https://www.google.com https://www.gstatic.com${scalarScriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://www.gravatar.com",
      `font-src 'self' data:${scalarDomains}`,
      "frame-src 'self' https://challenges.cloudflare.com https://www.google.com",
      `connect-src 'self' https://challenges.cloudflare.com https://stats.sheephost.fr${scalarDomains}`,
      frameAncestors,
    ].join("; ")
  );

  return response;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True for a state-changing request sent by another site with the user's cookies (CSRF).
 *
 * Session cookies are SameSite=Lax by default, but SameSite=None when iframe embedding is
 * enabled, and route handlers parse JSON bodies whatever their Content-Type (a cross-site
 * text/plain form can carry one). Requests without cookies, or authenticated by an
 * Authorization header (API keys), carry no ambient credential and are left alone. NextAuth
 * endpoints have their own CSRF token, and OAuth providers may POST back to them.
 */
export function isCrossSiteMutation(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return false;
  if (!request.headers.get("cookie") || request.headers.get("authorization")) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "cross-site";

  // Browsers without Fetch Metadata: compare the Origin with the hosts this app is served on
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const originHost = hostOf(origin);
  if (!originHost) return true; // "null" origin: sandboxed or privacy-redirected cross-site page
  const ownHosts = [
    request.headers.get("host"),
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
    hostOf(process.env.NEXTAUTH_URL),
  ].map((host) => host?.toLowerCase());
  return !ownHosts.includes(originHost);
}

// Setup status and iframe setting, cached so page navigations do not each trigger a
// loopback HTTP request (and its database queries). Once setup is done it never reverts.
const SETUP_STATE_TTL_MS = 30 * 1000;
let setupCompleted = false;
let cachedIframeSetting: { value: boolean; expiresAt: number } | null = null;

async function getSetupState(): Promise<{ needsSetup: boolean; allowIframeEmbedding: boolean }> {
  if (setupCompleted && cachedIframeSetting && cachedIframeSetting.expiresAt > Date.now()) {
    return { needsSetup: false, allowIframeEmbedding: cachedIframeSetting.value };
  }

  const port = process.env.PORT || "3000";
  const response = await fetch(new URL("/api/setup/check", `http://localhost:${port}`));
  if (!response.ok) {
    throw new Error(`Setup check failed with status ${response.status}`);
  }

  const data = await response.json();
  const allowIframeEmbedding = data.allowIframeEmbedding ?? false;
  if (!data.needsSetup) {
    setupCompleted = true;
    cachedIframeSetting = {
      value: allowIframeEmbedding,
      expiresAt: Date.now() + SETUP_STATE_TTL_MS,
    };
  }
  return { needsSetup: !!data.needsSetup, allowIframeEmbedding };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiDocs = pathname.startsWith("/api-docs");
  const isScalarHtml = pathname === "/scalar.html";

  if (isCrossSiteMutation(request)) {
    return addSecurityHeaders(apiError(request, ErrorCode.FORBIDDEN), isApiDocs, isScalarHtml);
  }

  // Skip setup check for setup page, API routes, and static assets
  if (
    pathname.startsWith("/setup") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/")
  ) {
    const response = NextResponse.next();
    return addSecurityHeaders(response, isApiDocs, isScalarHtml);
  }

  // Check if setup is needed (result cached, see getSetupState)
  let allowIframeEmbedding: boolean;
  try {
    const state = await getSetupState();
    allowIframeEmbedding = state.allowIframeEmbedding;

    if (state.needsSetup) {
      // Redirect to setup page if not already there
      const redirectResponse = NextResponse.redirect(new URL("/setup", request.url));
      return addSecurityHeaders(redirectResponse, isApiDocs, isScalarHtml);
    }
  } catch (error) {
    // If setup check fails due to network/database issues, fail open to avoid lockout
    console.error("Error checking setup status:", error);
    const nextResponse = NextResponse.next();
    return addSecurityHeaders(nextResponse, isApiDocs, isScalarHtml);
  }

  // Check authentication for protected routes
  const protectedPaths = ["/admin", "/dashboard", "/profile", "/api/protected"];
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

  if (isProtectedPath) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      const redirectResponse = NextResponse.redirect(signInUrl);
      return addSecurityHeaders(redirectResponse, isApiDocs, isScalarHtml, allowIframeEmbedding);
    }
  }

  const response = NextResponse.next();
  return addSecurityHeaders(response, isApiDocs, isScalarHtml, allowIframeEmbedding);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
