/**
 * GET  /api/v1/shares — List own shares (auth required)
 * POST /api/v1/shares — Create a link or paste share
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { createLinkShare, createPasteShare, toPublicShare } from "@/lib/shares";
import { getClientIp } from "@/lib/getClientIp";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.retryAfter) return rateLimitResponse(request, auth.retryAfter);
    const { user } = auth;
    if (!user) {
      return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    let take: number | undefined;
    if (limitParam !== null) {
      const parsedLimit = Number.parseInt(limitParam, 10);
      if (!Number.isNaN(parsedLimit)) {
        take = Math.min(100, Math.max(1, parsedLimit));
      }
    }

    let skip: number | undefined;
    if (offsetParam !== null) {
      const parsedOffset = Number.parseInt(offsetParam, 10);
      if (!Number.isNaN(parsedOffset) && parsedOffset >= 0) {
        skip = parsedOffset;
      }
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
      },
      ...(take !== undefined ? { take } : {}),
      ...(skip !== undefined ? { skip } : {}),
    });

    return NextResponse.json({ data: shares });
  } catch (error) {
    console.error("[GET /api/v1/shares]", error);
    return internalError(request);
  }
}

type CreateShareBody = {
  type?: string;
  urlOriginal?: string;
  paste?: string;
  pastelanguage?: string;
  slug?: string;
  password?: string;
  expiresAt?: string;
  maxViews?: number;
};

type CommonShareOptions = Pick<
  Parameters<typeof createLinkShare>[0],
  "context" | "expiresAt" | "slug" | "password" | "maxViews"
>;

async function createShareFromBody(body: CreateShareBody, common: CommonShareOptions) {
  if (body.type === "URL") {
    if (!body.urlOriginal) return { errorCode: ErrorCode.MISSING_DATA, share: undefined };
    const result = await createLinkShare({ ...common, urlOriginal: body.urlOriginal });
    return { errorCode: result.errorCode as ErrorCode | undefined, share: result.share };
  }

  if (!body.paste) return { errorCode: ErrorCode.PASTE_CONTENT_EMPTY, share: undefined };
  const result = await createPasteShare({
    ...common,
    paste: body.paste,
    pastelanguage: body.pastelanguage || "PLAINTEXT",
  });
  return { errorCode: result.errorCode as ErrorCode | undefined, share: result.share };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.retryAfter) return rateLimitResponse(request, auth.retryAfter);
    const { user } = auth;
    const ip = getClientIp(request);

    const context = {
      userId: user?.id ?? null,
      isAuthenticated: user != null,
      ip,
    };

    let body: CreateShareBody;
    try {
      body = await request.json();
    } catch {
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    if (body.type !== "URL" && body.type !== "PASTE") {
      return apiError(request, ErrorCode.SHARE_TYPE_INVALID);
    }

    const parsedExpiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    if (parsedExpiresAt && Number.isNaN(parsedExpiresAt.getTime())) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const common = {
      context,
      expiresAt: parsedExpiresAt,
      slug: body.slug,
      password: body.password,
      maxViews: typeof body.maxViews === "number" ? body.maxViews : undefined,
    };

    const outcome = await createShareFromBody(body, common);
    if (outcome.errorCode) return apiError(request, outcome.errorCode);
    return NextResponse.json({ share: toPublicShare(outcome.share!) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/shares]", error);
    return internalError(request);
  }
}
