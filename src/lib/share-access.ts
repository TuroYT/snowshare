import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/security";
import { apiError, ErrorCode } from "@/lib/api-errors";
import { getClientIp } from "@/lib/getClientIp";
import {
  getRetryAfter,
  rateLimitResponse,
  recordRateLimitHit,
  resetRateLimit,
} from "@/lib/rate-limit";

/**
 * Centralized access rules for shares: expiration, view limits, password checks
 * (rate limited) and short-lived signed download tokens.
 */

export interface AccessCheckedShare {
  id: string;
  password: string | null;
  expiresAt: Date | null;
  maxViews: number | null;
  viewCount: number;
}

export interface AccessDenied {
  errorCode: ErrorCode;
  requiresPassword?: boolean;
  /** Seconds to wait, set when errorCode is TOO_MANY_REQUESTS */
  retryAfter?: number;
}

/**
 * Translated error response for a denied access (429 with Retry-After when rate limited).
 */
export function accessDeniedResponse(
  request: NextRequest,
  denied: { errorCode: ErrorCode; retryAfter?: number }
) {
  if (denied.errorCode === ErrorCode.TOO_MANY_REQUESTS) {
    return rateLimitResponse(request, denied.retryAfter ?? 60);
  }
  return apiError(request, denied.errorCode);
}

export function isShareExpired(share: Pick<AccessCheckedShare, "expiresAt">): boolean {
  return !!share.expiresAt && new Date(share.expiresAt) <= new Date();
}

export function isShareExhausted(
  share: Pick<AccessCheckedShare, "maxViews" | "viewCount">
): boolean {
  return share.maxViews !== null && share.viewCount >= share.maxViews;
}

/**
 * Returns SHARE_EXPIRED when the share is past its expiration date or out of views.
 */
export function checkShareAvailability(
  share: Pick<AccessCheckedShare, "expiresAt" | "maxViews" | "viewCount">,
  { ignoreViewLimit = false }: { ignoreViewLimit?: boolean } = {}
): AccessDenied | null {
  if (isShareExpired(share)) return { errorCode: ErrorCode.SHARE_EXPIRED };
  if (!ignoreViewLimit && isShareExhausted(share)) return { errorCode: ErrorCode.SHARE_EXPIRED };
  return null;
}

/**
 * Verifies a share password. Failed attempts are rate limited per client IP and share.
 * Returns null when access is granted (or the share has no password).
 */
export async function verifySharePassword(
  request: NextRequest | null | undefined,
  share: Pick<AccessCheckedShare, "id" | "password">,
  password: string | undefined | null
): Promise<AccessDenied | null> {
  if (!share.password) return null;
  if (!password) return { errorCode: ErrorCode.PASSWORD_REQUIRED, requiresPassword: true };

  // Without a request (internal callers) there is no client to rate limit
  const key = request ? `${getClientIp(request)}:${share.id}` : null;
  if (key) {
    const retryAfter = getRetryAfter("sharePassword", key);
    if (retryAfter > 0) return { errorCode: ErrorCode.TOO_MANY_REQUESTS, retryAfter };
  }

  if (!(await verifyPassword(password, share.password))) {
    if (key) recordRateLimitHit("sharePassword", key);
    return { errorCode: ErrorCode.PASSWORD_INCORRECT };
  }

  if (key) resetRateLimit("sharePassword", key);
  return null;
}

/**
 * Atomically counts one view, only if the share still has views left and has not expired.
 * Returns false when the view limit was reached concurrently (or the share is gone).
 */
export async function consumeView(shareId: string): Promise<boolean> {
  const result = await prisma.share.updateMany({
    where: {
      id: shareId,
      AND: [
        { OR: [{ maxViews: null }, { viewCount: { lt: prisma.share.fields.maxViews } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ],
    },
    data: { viewCount: { increment: 1 } },
  });
  return result.count > 0;
}

// ---------------------------------------------------------------------------
// Signed download tokens
// ---------------------------------------------------------------------------

/**
 * - "download": issued after a view was consumed; grants downloads and previews of the share
 *   (bypasses the password and the view limit, since the view is already counted).
 * - "access": issued after a password check; replaces the password in URLs, but every
 *   request still consumes a view.
 *
 * Tokens are bound to the client IP that requested them, so a leaked URL cannot be
 * replayed from elsewhere, and expire after DOWNLOAD_TOKEN_TTL_SECONDS.
 */
export type DownloadTokenPurpose = "download" | "access";

// Long enough to start large downloads and seek in videos (Range requests reuse the token),
// short enough to keep "burn after reading" shares meaningful
export const DOWNLOAD_TOKEN_TTL_SECONDS = 15 * 60;

function getTokenSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign download tokens");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
}

export function createDownloadToken(
  shareId: string,
  purpose: DownloadTokenPurpose,
  clientIp: string,
  ttlSeconds = DOWNLOAD_TOKEN_TTL_SECONDS
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${purpose}.${expiresAt}`;
  return `${payload}.${sign(`${shareId}.${payload}.${clientIp}`)}`;
}

/**
 * Returns the token purpose when it is valid for this share and not expired, otherwise null.
 */
export function verifyDownloadToken(
  token: string | null | undefined,
  shareId: string,
  clientIp: string
): DownloadTokenPurpose | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [purpose, expiresAtRaw, signature] = parts;
  if (purpose !== "download" && purpose !== "access") return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

  let expected: string;
  try {
    expected = sign(`${shareId}.${purpose}.${expiresAtRaw}.${clientIp}`);
  } catch (error) {
    console.error("Download token verification failed:", error);
    return null;
  }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return purpose;
}
