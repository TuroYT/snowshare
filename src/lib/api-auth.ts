/**
 * API authentication middleware.
 * Supports API key (Bearer token) and NextAuth session auth.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/security";

export type AuthMethod = "apikey" | "session" | null;

export interface ApiAuthResult {
  user: { id: string; name?: string | null; email: string; isAdmin: boolean } | null;
  authMethod: AuthMethod;
}

/**
 * Authenticate an API request.
 *
 * Resolution order:
 * 1. `Authorization: Bearer sk_...` → SHA-256 hash lookup in ApiKey table
 * 2. NextAuth session cookie
 * 3. Unauthenticated (anonymous)
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");

  // 1. API key via Bearer token
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    if (rawKey.startsWith("sk_")) {
      const keyHash = hashApiKey(rawKey);
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          user: {
            select: { id: true, name: true, email: true, isAdmin: true },
          },
        },
      });

      if (apiKey) {
        // Check expiration
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          return { user: null, authMethod: null };
        }

        // Update lastUsedAt asynchronously (fire and forget)
        prisma.apiKey
          .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
          .catch((err) => console.warn("[api-auth] Failed to update lastUsedAt:", err.message));

        return { user: apiKey.user, authMethod: "apikey" };
      }
    }
  }

  // 2. NextAuth session
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, isAdmin: true },
    });
    if (user) {
      return { user, authMethod: "session" };
    }
  }

  // 3. Anonymous
  return { user: null, authMethod: null };
}
