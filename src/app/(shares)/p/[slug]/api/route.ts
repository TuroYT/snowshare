import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { NextRequest } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { detectLocale, translate } from "@/lib/i18n-server";
import { logShareAccess } from "@/lib/access-log";
import {
  accessDeniedResponse,
  checkShareAvailability,
  consumeView,
  verifySharePassword,
} from "@/lib/share-access";

const PASTE_SELECT = {
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
} satisfies Prisma.ShareSelect;

type PasteShare = Prisma.ShareGetPayload<{ select: typeof PASTE_SELECT }>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/** Counts the view, logs the access and returns the paste content. */
async function servePaste(request: NextRequest, share: PasteShare) {
  if (!(await consumeView(share.id))) {
    return apiError(request, ErrorCode.SHARE_EXPIRED);
  }

  void logShareAccess(request, share.id);

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
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    if (!slug) {
      return apiError(request, ErrorCode.MISSING_DATA);
    }

    const share = await prisma.share.findUnique({
      where: { slug },
      select: PASTE_SELECT,
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    const unavailable = checkShareAvailability(share);
    if (unavailable) return accessDeniedResponse(request, unavailable);

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

    return servePaste(request, share);
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
      select: PASTE_SELECT,
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    const unavailable = checkShareAvailability(share);
    if (unavailable) return accessDeniedResponse(request, unavailable);

    if (share.type !== "PASTE") {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    if (!share.password) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const denied = await verifySharePassword(request, share, password);
    if (denied) return accessDeniedResponse(request, denied);

    return servePaste(request, share);
  } catch (error) {
    console.error("Error verifying paste password:", error);
    return internalError(request);
  }
}
