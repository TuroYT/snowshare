import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendShareEmail, isEmailEnabled } from "@/lib/email";
import { apiError, ErrorCode } from "@/lib/api-errors";
import { isValidEmail } from "@/lib/constants";
import { detectLocale, translate } from "@/lib/i18n-server";
import { getRetryAfter, rateLimitResponse, recordRateLimitHit } from "@/lib/rate-limit";

/** Maximum recipients per request, to keep the instance SMTP from being used as a relay */
const MAX_RECIPIENTS = 20;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }

  const emailEnabled = await isEmailEnabled();
  if (!emailEnabled) {
    return apiError(request, ErrorCode.EMAIL_NOT_CONFIGURED);
  }

  let body: { slug?: unknown; recipients?: unknown };
  try {
    body = await request.json();
  } catch (error) {
    console.error("send-email: invalid JSON body:", error);
    return apiError(request, ErrorCode.INVALID_JSON);
  }
  const { slug, recipients } = body;

  if (!slug || typeof slug !== "string") {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return apiError(request, ErrorCode.RECIPIENTS_REQUIRED);
  }

  if (recipients.length > MAX_RECIPIENTS) {
    return apiError(request, ErrorCode.TOO_MANY_RECIPIENTS, { max: MAX_RECIPIENTS });
  }

  // Each recipient counts toward the per-user hourly quota
  const retryAfter = getRetryAfter("sendEmail", session.user.id);
  if (retryAfter > 0) {
    return rateLimitResponse(request, retryAfter);
  }

  const invalidEmail = recipients.find((r: unknown) => typeof r !== "string" || !isValidEmail(r));
  if (invalidEmail !== undefined) {
    return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT);
  }

  const share = await prisma.share.findFirst({
    where: {
      slug,
      ownerId: session.user.id,
    },
  });
  if (!share) {
    return apiError(request, ErrorCode.SHARE_NOT_FOUND);
  }

  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const prefix = share.type === "FILE" ? "f" : share.type === "PASTE" ? "p" : "l";
  const shareUrl = `${baseUrl}/${prefix}/${slug}`;

  for (let i = 0; i < recipients.length; i++) {
    recordRateLimitHit("sendEmail", session.user.id);
  }

  try {
    await sendShareEmail(shareUrl, slug, recipients);
  } catch (error) {
    console.error("send-email: failed to send share email:", error);
    return apiError(request, ErrorCode.EMAIL_SEND_FAILED);
  }

  return NextResponse.json({
    message: translate(detectLocale(request), "api.messages.email_sent"),
  });
}
