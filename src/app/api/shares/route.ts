// Link and Paste shares only: files go through /api/upload (streamed to disk).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createLinkShare, createPasteShare, toPublicShare } from "@/lib/shares";
import { getClientIp } from "@/lib/getClientIp";
import { apiError, ErrorCode } from "@/lib/api-errors";

async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return apiError(req, ErrorCode.INVALID_REQUEST);
  }

  try {
    const data = await req.json();
    if (!data?.type) {
      return apiError(req, ErrorCode.SHARE_TYPE_REQUIRED);
    }

    const session = await getServerSession(authOptions);
    const context = {
      userId: session?.user?.id ?? null,
      isAuthenticated: !!session,
      ip: getClientIp(req),
    };

    switch (data.type) {
      case "URL": {
        const { urlOriginal, expiresAt, slug, password, maxViews } = data;
        const result = await createLinkShare({
          urlOriginal,
          context,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          slug,
          password,
          maxViews,
        });
        if (result?.errorCode) {
          return apiError(req, result.errorCode, result.params);
        }
        return NextResponse.json(
          { share: { linkShare: toPublicShare(result.share!) } },
          { status: 201 }
        );
      }
      case "PASTE": {
        const { paste, pastelanguage, expiresAt, slug, password, maxViews } = data;
        const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
        const result = await createPasteShare({
          paste,
          pastelanguage,
          context,
          expiresAt: expiresAtDate,
          slug,
          password,
          maxViews,
        });
        if (result?.errorCode) {
          return apiError(req, result.errorCode, result.params);
        }
        return NextResponse.json(
          { share: { pasteShare: toPublicShare(result.share!) } },
          { status: 201 }
        );
      }
      default:
        return apiError(req, ErrorCode.SHARE_TYPE_INVALID);
    }
  } catch (err) {
    console.error("JSON parsing error:", err);
    return apiError(req, ErrorCode.INVALID_JSON);
  }
}

export { POST };
