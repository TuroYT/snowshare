import { NextRequest } from "next/server";

/**
 * Retrieve the client's IP address from a NextRequest.
 *
 * Set TRUSTED_PROXY_DEPTH to the number of trusted reverse proxies in front of this server
 * (default 0 = read leftmost XFF entry, same as the legacy behaviour).
 *
 * With TRUSTED_PROXY_DEPTH=1 the rightmost IP in X-Forwarded-For is the address appended by
 * your trusted proxy, so we read the entry one position to the left of it (the real client).
 * With TRUSTED_PROXY_DEPTH=0 (default) the leftmost entry is used as-is, which is correct when
 * the reverse proxy *replaces* rather than appends to XFF.
 *
 * In both cases configure your reverse proxy to strip or replace client-supplied XFF headers.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);

    const depth = parseInt(process.env.TRUSTED_PROXY_DEPTH ?? "0", 10);
    if (depth > 0 && ips.length > depth) {
      // Skip the rightmost `depth` entries (trusted proxy hops), use the one before them
      return ips[ips.length - 1 - depth];
    }
    return ips[0];
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}
