import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { detectLocale, translate } from "@/lib/i18n-server";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    if (!slug) {
      return apiError(request, ErrorCode.MISSING_DATA);
    }

    const share = await prisma.share.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        paste: true,
        pastelanguage: true,
        password: true,
        createdAt: true,
        expiresAt: true,
        slug: true,
        ownerId: true,
        maxViews: true,
        viewCount: true,
      },
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.maxViews !== null && share.viewCount >= share.maxViews) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.type !== "PASTE") {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    if (share.password) {
      const locale = detectLocale(request);
      const errorMsg = translate(locale, "api.errors.password_required");
      return jsonResponse(
        {
          error: errorMsg,
          requiresPassword: true,
          slug: share.slug,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
        },
        403
      );
    }

    // Increment view count
    await prisma.share.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    return jsonResponse({
      success: true,
      data: {
        paste: share.paste,
        language: share.pastelanguage,
        slug: share.slug,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        ownerId: share.ownerId,
      },
    });
  } catch (error) {
    console.error("Error fetching paste:", error);
    return internalError(request);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return apiError(request, ErrorCode.MISSING_DATA);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    const { password } = body;

    if (!password || typeof password !== "string") {
      return apiError(request, ErrorCode.MISSING_DATA);
    }

    const share = await prisma.share.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        paste: true,
        pastelanguage: true,
        password: true,
        createdAt: true,
        expiresAt: true,
        slug: true,
        ownerId: true,
        maxViews: true,
        viewCount: true,
      },
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.expiresAt && new Date(share.expiresAt) <= new Date()) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.maxViews !== null && share.viewCount >= share.maxViews) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    if (share.type !== "PASTE") {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    if (!share.password) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const isPasswordValid = await bcrypt.compare(password, share.password);

    if (!isPasswordValid) {
      return apiError(request, ErrorCode.PASSWORD_INCORRECT);
    }

    // Increment view count
    await prisma.share.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    return jsonResponse({
      success: true,
      data: {
        paste: share.paste,
        language: share.pastelanguage,
        slug: share.slug,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        ownerId: share.ownerId,
      },
    });
  } catch (error) {
    console.error("Error verifying paste password:", error);
    return internalError(request);
  }
}
