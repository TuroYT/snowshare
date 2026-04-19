import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendShareEmail, isEmailEnabled } from "@/lib/email";
import { apiError, ErrorCode } from "@/lib/api-errors";
import { isValidEmail } from "@/lib/constants";

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
  } catch {
    return apiError(request, ErrorCode.INVALID_JSON);
  }
  const { slug, recipients } = body;

  if (!slug || typeof slug !== "string") {
    return apiError(request, ErrorCode.MISSING_DATA);
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return apiError(request, ErrorCode.RECIPIENTS_REQUIRED);
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

  try {
    await sendShareEmail(shareUrl, slug, recipients);
  } catch {
    return apiError(request, ErrorCode.EMAIL_SEND_FAILED);
  }

  return NextResponse.json({ message: "Email sent successfully" });
}
