/**
 * GET  /api/user/totp — Two-factor status (session required)
 * POST /api/user/totp — { action: "setup" } returns a new secret to scan;
 *                       { action: "enable", code } turns it on once a code checks out;
 *                       { action: "disable", code } turns it off.
 * Only accounts with a password can use it: it protects the email/password sign-in.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { getSettingsCached } from "@/lib/settings";
import {
  getRetryAfter,
  rateLimitResponse,
  recordRateLimitHit,
  resetRateLimit,
} from "@/lib/rate-limit";
import {
  generateTotpSecret,
  openTotpSecret,
  sealTotpSecret,
  totpAuthUrl,
  verifyTotp,
} from "@/lib/totp";

async function currentUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: apiError(request, ErrorCode.AUTHENTICATION_REQUIRED) };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      password: true,
      totpEnabled: true,
      totpSecret: true,
      totpLastCounter: true,
    },
  });
  if (!user) return { error: apiError(request, ErrorCode.USER_NOT_FOUND) };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await currentUser(request);
    if (error) return error;
    return NextResponse.json({ enabled: user.totpEnabled, available: !!user.password });
  } catch (error) {
    console.error("[GET /api/user/totp]", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await currentUser(request);
    if (error) return error;
    if (!user.password) return apiError(request, ErrorCode.INVALID_REQUEST);

    let body: { action?: string; code?: string };
    try {
      body = await request.json();
    } catch {
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    if (body.action === "setup") {
      if (user.totpEnabled) return apiError(request, ErrorCode.INVALID_REQUEST);
      const secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: sealTotpSecret(secret), totpLastCounter: null },
      });
      const issuer = (await getSettingsCached())?.appName || "SnowShare";
      return NextResponse.json({ secret, otpauthUrl: totpAuthUrl(secret, user.email, issuer) });
    }

    if (body.action !== "enable" && body.action !== "disable") {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }
    if (!user.totpSecret || user.totpEnabled !== (body.action === "disable")) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const retryAfter = getRetryAfter("totpVerify", user.id);
    if (retryAfter > 0) return rateLimitResponse(request, retryAfter);
    const counter = verifyTotp(openTotpSecret(user.totpSecret), body.code ?? "", {
      lastCounter: user.totpLastCounter,
    });
    if (counter === null) {
      recordRateLimitHit("totpVerify", user.id);
      return apiError(request, ErrorCode.TOKEN_INVALID);
    }
    resetRateLimit("totpVerify", user.id);

    await prisma.user.update({
      where: { id: user.id },
      data:
        body.action === "enable"
          ? { totpEnabled: true, totpLastCounter: counter }
          : { totpEnabled: false, totpSecret: null, totpLastCounter: null },
    });
    return NextResponse.json({ enabled: body.action === "enable" });
  } catch (error) {
    console.error("[POST /api/user/totp]", error);
    return internalError(request);
  }
}
