import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { sendResetLinkEmail } from "@/lib/email";
import { createPasswordResetToken, isPasswordResetAvailable } from "@/lib/password-reset";
import { detectLocale, translate } from "@/lib/i18n-server";
import { getClientIp } from "@/lib/getClientIp";
import {
  consumeRateLimit,
  getRetryAfter,
  rateLimitResponse,
  recordRateLimitHit,
} from "@/lib/rate-limit";

/**
 * Creates the token and sends the e-mail. Runs after the response so the answer takes the same
 * time whether or not the address belongs to an account.
 */
async function issueResetEmail(userId: string, email: string): Promise<void> {
  try {
    const token = await createPasswordResetToken(userId);
    await sendResetLinkEmail(email, token);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const retryAfter = consumeRateLimit("passwordReset", getClientIp(request));
    if (retryAfter > 0) {
      return rateLimitResponse(request, retryAfter);
    }

    if (!(await isPasswordResetAvailable())) {
      return apiError(request, ErrorCode.EMAIL_NOT_CONFIGURED);
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email) {
      return apiError(request, ErrorCode.EMAIL_REQUIRED);
    }
    if (!isValidEmail(email)) {
      return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
    }

    // Same answer whatever happens below, so the form cannot be used to list accounts
    const response = NextResponse.json({
      message: translate(detectLocale(request), "api.messages.password_reset_requested"),
    });

    // One mail a minute and five an hour per address: past it, stay silent instead of answering 429 (which would
    // reveal that the address is being mailed). Earlier links stay valid, so someone spamming an
    // address can neither cancel the owner's link nor flood the mailbox.
    const addressKey = email.toLowerCase();
    if (
      getRetryAfter("passwordResetEmail", addressKey) > 0 ||
      getRetryAfter("passwordResetEmailHourly", addressKey) > 0
    ) {
      return response;
    }
    recordRateLimitHit("passwordResetEmail", addressKey);
    recordRateLimitHit("passwordResetEmailHourly", addressKey);

    // Passwordless (SSO-only) accounts have nothing to reset: giving them a password here
    // would change how they can sign in (and drop them from verified-email SSO auto-links).
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });
    if (user?.password) {
      void issueResetEmail(user.id, user.email);
    }

    return response;
  } catch (error) {
    console.error("Forgot password error:", error);
    return internalError(request);
  }
}
