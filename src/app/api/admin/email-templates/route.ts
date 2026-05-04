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

const TEMPLATE_FIELDS = [
  "shareEmailSubject",
  "shareEmailHtml",
  "shareEmailText",
  "verifyEmailSubject",
  "verifyEmailHtml",
  "verifyEmailText",
] as const;

type TemplateField = (typeof TEMPLATE_FIELDS)[number];
type TemplateData = Partial<Record<TemplateField, string | null>>;

function pickProvided(data: TemplateData) {
  const out: Record<string, string | null> = {};
  for (const key of TEMPLATE_FIELDS) {
    if (data[key] !== undefined) out[key] = data[key]!;
  }
  return out;
}

function buildCreateData(data: TemplateData) {
  return {
    shareEmailSubject: data.shareEmailSubject ?? null,
    shareEmailHtml: data.shareEmailHtml ?? null,
    shareEmailText: data.shareEmailText ?? null,
    verifyEmailSubject: data.verifyEmailSubject ?? null,
    verifyEmailHtml: data.verifyEmailHtml ?? null,
    verifyEmailText: data.verifyEmailText ?? null,
  };
}

function pickTemplates<T extends TemplateData>(settings: T) {
  return {
    shareEmailSubject: settings.shareEmailSubject,
    shareEmailHtml: settings.shareEmailHtml,
    shareEmailText: settings.shareEmailText,
    verifyEmailSubject: settings.verifyEmailSubject,
    verifyEmailHtml: settings.verifyEmailHtml,
    verifyEmailText: settings.verifyEmailText,
  };
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  try {
    const data = (await request.json()) as TemplateData;
    const existing = await prisma.settings.findFirst();

    const settings = existing
      ? await prisma.settings.update({
          where: { id: existing.id },
          data: pickProvided(data),
        })
      : await prisma.settings.create({ data: buildCreateData(data) });

    return NextResponse.json({ templates: pickTemplates(settings) });
  } catch (error) {
    console.error("Error updating email templates:", error);
    return internalError(request);
  }
}
