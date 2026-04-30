import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import {
  DEFAULT_SHARE_SUBJECT,
  DEFAULT_SHARE_HTML,
  DEFAULT_SHARE_TEXT,
  DEFAULT_VERIFY_SUBJECT,
  DEFAULT_VERIFY_HTML,
  DEFAULT_VERIFY_TEXT,
} from "@/lib/email-templates";

async function requireAdminUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: apiError(request, ErrorCode.UNAUTHORIZED) };
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) {
    return { error: apiError(request, ErrorCode.ADMIN_ONLY) };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  try {
    const settings = await prisma.settings.findFirst({
      select: {
        emailDefaultLocale: true,
        shareEmailSubject: true,
        shareEmailHtml: true,
        shareEmailText: true,
        verifyEmailSubject: true,
        verifyEmailHtml: true,
        verifyEmailText: true,
      },
    });

    return NextResponse.json({
      templates: {
        emailDefaultLocale: settings?.emailDefaultLocale ?? "en",
        shareEmailSubject: settings?.shareEmailSubject ?? null,
        shareEmailHtml: settings?.shareEmailHtml ?? null,
        shareEmailText: settings?.shareEmailText ?? null,
        verifyEmailSubject: settings?.verifyEmailSubject ?? null,
        verifyEmailHtml: settings?.verifyEmailHtml ?? null,
        verifyEmailText: settings?.verifyEmailText ?? null,
      },
      defaults: {
        shareEmailSubject: DEFAULT_SHARE_SUBJECT,
        shareEmailHtml: DEFAULT_SHARE_HTML,
        shareEmailText: DEFAULT_SHARE_TEXT,
        verifyEmailSubject: DEFAULT_VERIFY_SUBJECT,
        verifyEmailHtml: DEFAULT_VERIFY_HTML,
        verifyEmailText: DEFAULT_VERIFY_TEXT,
      },
    });
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return internalError(request);
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  try {
    const data = await request.json();

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          emailDefaultLocale: data.emailDefaultLocale ?? "en",
          shareEmailSubject: data.shareEmailSubject ?? null,
          shareEmailHtml: data.shareEmailHtml ?? null,
          shareEmailText: data.shareEmailText ?? null,
          verifyEmailSubject: data.verifyEmailSubject ?? null,
          verifyEmailHtml: data.verifyEmailHtml ?? null,
          verifyEmailText: data.verifyEmailText ?? null,
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          emailDefaultLocale:
            data.emailDefaultLocale !== undefined
              ? data.emailDefaultLocale
              : settings.emailDefaultLocale,
          shareEmailSubject:
            data.shareEmailSubject !== undefined
              ? data.shareEmailSubject
              : settings.shareEmailSubject,
          shareEmailHtml:
            data.shareEmailHtml !== undefined ? data.shareEmailHtml : settings.shareEmailHtml,
          shareEmailText:
            data.shareEmailText !== undefined ? data.shareEmailText : settings.shareEmailText,
          verifyEmailSubject:
            data.verifyEmailSubject !== undefined
              ? data.verifyEmailSubject
              : settings.verifyEmailSubject,
          verifyEmailHtml:
            data.verifyEmailHtml !== undefined ? data.verifyEmailHtml : settings.verifyEmailHtml,
          verifyEmailText:
            data.verifyEmailText !== undefined ? data.verifyEmailText : settings.verifyEmailText,
        },
      });
    }

    return NextResponse.json({
      templates: {
        emailDefaultLocale: settings.emailDefaultLocale,
        shareEmailSubject: settings.shareEmailSubject,
        shareEmailHtml: settings.shareEmailHtml,
        shareEmailText: settings.shareEmailText,
        verifyEmailSubject: settings.verifyEmailSubject,
        verifyEmailHtml: settings.verifyEmailHtml,
        verifyEmailText: settings.verifyEmailText,
      },
    });
  } catch (error) {
    console.error("Error updating email templates:", error);
    return internalError(request);
  }
}
