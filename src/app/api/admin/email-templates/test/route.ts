import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { renderShareEmail, renderVerifyEmail } from "@/lib/email-templates";
import { isEmailEnabled } from "@/lib/email";
import nodemailer from "nodemailer";

type TestPayload = {
  type: "share" | "verify";
  subject?: string | null;
  html?: string | null;
  text?: string | null;
};

type SmtpSettings = {
  appName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  smtpSecure: boolean;
};

async function authenticateAdmin(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: apiError(request, ErrorCode.UNAUTHORIZED) };
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) {
    return { error: apiError(request, ErrorCode.ADMIN_ONLY) };
  }
  if (!user.email) {
    return { error: apiError(request, ErrorCode.INVALID_REQUEST) };
  }
  return { user };
}

function buildTransporter(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost!,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpSecure,
    auth:
      settings.smtpUser && settings.smtpPassword
        ? { user: settings.smtpUser, pass: settings.smtpPassword }
        : undefined,
  });
}

function renderTestEmail(
  payload: TestPayload,
  appName: string,
  userEmail: string
): { subject: string; html: string; text: string } | null {
  const baseUrl = process.env.NEXTAUTH_URL || "https://example.com";
  const overrides = { subject: payload.subject, html: payload.html, text: payload.text };

  if (payload.type === "share") {
    return renderShareEmail(
      { appName, shareTitle: "example-file.pdf", shareUrl: `${baseUrl}/f/abc123` },
      overrides
    );
  }
  if (payload.type === "verify") {
    return renderVerifyEmail(
      {
        appName,
        verifyUrl: `${baseUrl}/auth/verify-email?token=test-token&email=${encodeURIComponent(userEmail)}`,
      },
      overrides
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  if (!(await isEmailEnabled())) {
    return apiError(request, ErrorCode.EMAIL_NOT_CONFIGURED);
  }

  try {
    const payload = (await request.json()) as TestPayload;

    const settings = (await prisma.settings.findFirst({
      select: {
        appName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPassword: true,
        smtpFrom: true,
        smtpSecure: true,
      },
    })) as SmtpSettings | null;

    if (!settings?.smtpHost) {
      return apiError(request, ErrorCode.EMAIL_NOT_CONFIGURED);
    }

    const appName = settings.appName || "SnowShare";
    const fromAddress = settings.smtpFrom || settings.smtpUser || `noreply@snowshare`;
    const rendered = renderTestEmail(payload, appName, auth.user.email!);

    if (!rendered) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    // rendered.html has been sanitised by sanitizeEmailHtml() inside the renderers
    // (script tags and javascript: URIs are stripped). It is sent as SMTP email
    // content to the admin's own address, never written to a web response.
    await buildTransporter(settings).sendMail({
      from: `"${appName}" <${fromAddress}>`,
      to: auth.user.email!,
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
