import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { hashPassword } from "@/lib/security";
import {
  hashResetToken,
  isPasswordResetAvailable,
  isPasswordResetTokenValid,
} from "@/lib/password-reset";
import { detectLocale, translate } from "@/lib/i18n-server";
import { getClientIp } from "@/lib/getClientIp";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/** Lets the reset page tell an expired link from a usable one before the user types anything. */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return apiError(request, ErrorCode.TOKEN_REQUIRED);
    }
    const retryAfter = consumeRateLimit("passwordReset", `check:${getClientIp(request)}`);
    if (retryAfter > 0) {
      return rateLimitResponse(request, retryAfter);
    }
    if (!(await isPasswordResetAvailable()) || !(await isPasswordResetTokenValid(token))) {
      return apiError(request, ErrorCode.TOKEN_INVALID_OR_EXPIRED);
    }
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Reset token check error:", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const retryAfter = consumeRateLimit("passwordReset", `submit:${getClientIp(request)}`);
    if (retryAfter > 0) {
      return rateLimitResponse(request, retryAfter);
    }

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const password = body?.password;
    if (!token) {
      return apiError(request, ErrorCode.TOKEN_REQUIRED);
    }
    if (typeof password !== "string" || !isValidPassword(password)) {
      return apiError(request, ErrorCode.PASSWORD_LENGTH, {
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH,
      });
    }
    if (!(await isPasswordResetAvailable())) {
      return apiError(request, ErrorCode.TOKEN_INVALID_OR_EXPIRED);
    }

    const hashedPassword = await hashPassword(password);
    const tokenHash = hashResetToken(token);

    // Claiming the token and changing the password happen together: a double submit cannot
    // reuse the link, and a failed update does not burn it.
    const changed = await prisma.$transaction(async (tx) => {
      const record = await tx.verificationToken.findUnique({ where: { token: tokenHash } });
      const prefix = "password-reset:";
      if (!record?.identifier.startsWith(prefix) || record.expires <= new Date()) return false;

      const claimed = await tx.verificationToken.deleteMany({
        where: { token: tokenHash, expires: { gt: new Date() } },
      });
      if (claimed.count !== 1) return false;

      const userId = record.identifier.slice(prefix.length);
      const updated = await tx.user.updateMany({
        where: { id: userId, password: { not: null } },
        data: { password: hashedPassword, mustChangePassword: false },
      });
      if (updated.count !== 1) return false;

      // Reading the mail proves the address is theirs: do not lock out an unverified account
      await tx.user.updateMany({
        where: { id: userId, emailVerified: null },
        data: { emailVerified: new Date() },
      });
      await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } });
      return true;
    });

    if (!changed) {
      return apiError(request, ErrorCode.TOKEN_INVALID_OR_EXPIRED);
    }

    return NextResponse.json({
      success: true,
      message: translate(detectLocale(request), "api.messages.password_reset_done"),
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return internalError(request);
  }
}
