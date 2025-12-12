import { NextRequest } from "next/server";

/**
 * Retrieve the client's IP address from a NextRequest by inspecting common proxy headers.
 *
 * The lookup order is:
 * 1. "x-forwarded-for" — if present, returns the first IP in the comma-separated list (trimmed).
 * 2. "x-real-ip" — if present, returns the trimmed header value.
 * 3. Fallback — returns the string "unknown" when no suitable header is found.
 *
 * @param request - The NextRequest whose headers will be inspected.
 * @returns The resolved client IP as a string, or "unknown" if it cannot be determined.
 * @remarks NextRequest does not expose the client IP directly, so headers set by proxies/load
 * balancers are relied upon. Ensure trusted proxies set these headers to avoid spoofing.
 */
export function getClientIp(request: NextRequest): string {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Fallback to unknown (NextRequest doesn't expose IP directly)
  return "unknown";
}