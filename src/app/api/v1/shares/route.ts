/**
 * GET  /api/v1/shares — List own shares (auth required)
 * POST /api/v1/shares — Create a link or paste share
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { createLinkShare, createPasteShare } from "@/lib/shares";
import { getClientIp } from "@/lib/getClientIp";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const { user } = await authenticateApiRequest(request);
    if (!user) {
      return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);
    }

    const shares = await prisma.share.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        slug: true,
        expiresAt: true,
        createdAt: true,
        maxViews: true,
        viewCount: true,
        isBulk: true,
        urlOriginal: true,
        pastelanguage: true,
        filePath: true,
      },
    });

    return NextResponse.json({ data: shares });
  } catch (error) {
    console.error("[GET /api/v1/shares]", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, authMethod } = await authenticateApiRequest(request);
    const ip = getClientIp(request);

    const context = {
      userId: user?.id ?? null,
      isAuthenticated: user != null,
      ip,
    };

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    const { type, urlOriginal, paste, pastelanguage, slug, password, expiresAt, maxViews } = body as {
      type?: string;
      urlOriginal?: string;
      paste?: string;
      pastelanguage?: string;
      slug?: string;
      password?: string;
      expiresAt?: string;
      maxViews?: number;
    };

    if (!type || (type !== "URL" && type !== "PASTE")) {
      return apiError(request, ErrorCode.SHARE_TYPE_INVALID);
    }

    const parsedExpiresAt = expiresAt ? new Date(expiresAt) : undefined;

    if (type === "URL") {
      if (!urlOriginal) return apiError(request, ErrorCode.MISSING_DATA);
      const result = await createLinkShare({
        urlOriginal,
        context,
        expiresAt: parsedExpiresAt,
        slug,
        password,
        maxViews: typeof maxViews === "number" ? maxViews : undefined,
      });
      if (result.errorCode) return apiError(request, result.errorCode as ErrorCode);
      return NextResponse.json({ share: result.share }, { status: 201 });
    }

    // PASTE
    if (!paste) return apiError(request, ErrorCode.PASTE_CONTENT_EMPTY);
    const result = await createPasteShare({
      paste,
      pastelanguage: pastelanguage || "PLAINTEXT",
      context,
      expiresAt: parsedExpiresAt,
      slug,
      password,
      maxViews: typeof maxViews === "number" ? maxViews : undefined,
    });
    if (result.errorCode) return apiError(request, result.errorCode as ErrorCode);
    return NextResponse.json({ share: result.share }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/shares]", error);
    return internalError(request);
  }
}
