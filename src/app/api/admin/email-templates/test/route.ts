import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { renderShareEmail, renderVerifyEmail } from "@/lib/email-templates";
import { isEmailEnabled } from "@/lib/email";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  if (!user.email) {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }

  const emailEnabled = await isEmailEnabled();
  if (!emailEnabled) {
    return apiError(request, ErrorCode.EMAIL_NOT_CONFIGURED);
  }

  try {
    const data = await request.json();
    const { type, subject, html, text } = data as {
      type: "share" | "verify";
      subject?: string | null;
      html?: string | null;
      text?: string | null;
    };

    const settings = await prisma.settings.findFirst({
      select: {
        appName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFrom: true,
        smtpSecure: true,
      },
    });

    if (!settings?.smtpHost) {
      return apiError(request, ErrorCode.EMAIL_NOT_CONFIGURED);
    }

    const appName = settings.appName || "SnowShare";
    const fromAddress = settings.smtpFrom || settings.smtpUser || `noreply@snowshare`;

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      secure: settings.smtpSecure,
      auth:
        settings.smtpUser && settings.smtpPassword
          ? { user: settings.smtpUser, pass: settings.smtpPassword }
          : undefined,
    });

    let rendered: { subject: string; html: string; text: string };

    if (type === "share") {
      rendered = renderShareEmail(
        {
          appName,
          shareTitle: "example-file.pdf",
          shareUrl: `${process.env.NEXTAUTH_URL || "https://example.com"}/f/abc123`,
        },
        { subject, html, text }
      );
    } else if (type === "verify") {
      rendered = renderVerifyEmail(
        {
          appName,
          verifyUrl: `${process.env.NEXTAUTH_URL || "https://example.com"}/auth/verify-email?token=test-token&email=${encodeURIComponent(user.email)}`,
        },
        { subject, html, text }
      );
    } else {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    await transporter.sendMail({
      from: `"${appName}" <${fromAddress}>`,
      to: user.email,
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });

    return NextResponse.json({ message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    return internalError(request);
  }
}
