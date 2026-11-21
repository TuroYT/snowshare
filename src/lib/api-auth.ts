import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/security";
import { getClientIp } from "@/lib/getClientIp";
import { getRetryAfter, recordRateLimitHit } from "@/lib/rate-limit";

export type AuthMethod = "apikey" | "session" | null;

export interface ApiAuthResult {
  user: { id: string; name?: string | null; email: string; isAdmin: boolean } | null;
  authMethod: AuthMethod;
  /** Set when too many invalid API keys came from this client: callers must answer 429 */
  retryAfter?: number;
}

const AUTH_USER_SELECT = { id: true, name: true, email: true, isAdmin: true } as const;

/**
 * Resolves a `Bearer sk_...` API key. Returns null when the header carries no API key,
 * so the caller falls back to the session.
 */
async function authenticateWithApiKey(
  request: NextRequest,
  authHeader: string | null
): Promise<ApiAuthResult | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("sk_")) return null;

  // Clients that keep presenting invalid keys are refused without a lookup
  const clientIp = getClientIp(request);
  const retryAfter = getRetryAfter("apiKey", clientIp);
  if (retryAfter > 0) {
    return { user: null, authMethod: null, retryAfter };
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: AUTH_USER_SELECT,
      },
    },
  });

  if (!apiKey) {
    recordRateLimitHit("apiKey", clientIp);
    return null;
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { user: null, authMethod: null };
  }

  // Fire and forget: the response does not wait for lastUsedAt
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch((err: Error) => console.warn("[api-auth] Failed to update lastUsedAt:", err.message));

  return { user: apiKey.user, authMethod: "apikey" };
}

/** Resolution order: `Bearer sk_...` API key, then NextAuth session, then anonymous. */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const apiKeyResult = await authenticateWithApiKey(request, request.headers.get("authorization"));
  if (apiKeyResult) return apiKeyResult;

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: AUTH_USER_SELECT,
    });
    if (user) {
      return { user, authMethod: "session" };
    }
  }

  return { user: null, authMethod: null };
}
