import { isIP } from "net";
import type { NextRequest } from "next/server";

const LOCALHOST = "127.0.0.1";

/**
 * Number of trusted reverse proxies in front of the app (TRUSTED_PROXY_COUNT, default 1).
 *
 * Each proxy appends the address it received the request from to X-Forwarded-For, so the
 * client IP is the N-th entry counted from the right. Entries further left are supplied by
 * the client and can be forged, so they are never trusted.
 */
export function getTrustedProxyCount(): number {
  const parsed = parseInt(process.env.TRUSTED_PROXY_COUNT || "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim();
  if (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4) {
    ip = ip.slice(7);
  }
  if (ip === "::1") return LOCALHOST;
  return isIP(ip) ? ip : null;
}

/**
 * Resolve the client IP from raw header values. Shared by Next.js routes and server.js.
 *
 * Lookup order:
 * 1. X-Forwarded-For — the entry appended by the outermost trusted proxy (see TRUSTED_PROXY_COUNT).
 * 2. X-Real-IP.
 * 3. The socket remote address, when available.
 * 4. "127.0.0.1".
 * Values that are not valid IP addresses are ignored.
 */
export function resolveClientIp(sources: {
  forwardedFor?: string | null;
  realIp?: string | null;
  remoteAddress?: string | null;
}): string {
  if (sources.forwardedFor) {
    const hops = sources.forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const index = Math.max(0, hops.length - getTrustedProxyCount());
    const ip = normalizeIp(hops[index]);
    if (ip) return ip;
  }

  return normalizeIp(sources.realIp) || normalizeIp(sources.remoteAddress) || LOCALHOST;
}

/**
 * Retrieve the client's IP address from a NextRequest.
 *
 * Next.js sets X-Forwarded-For to the socket address when no proxy provided one, so
 * without a reverse proxy the last entry is the real peer address.
 */
export function getClientIp(request: NextRequest): string {
  return resolveClientIp({
    forwardedFor: request.headers.get("x-forwarded-for"),
    realIp: request.headers.get("x-real-ip"),
  });
}
