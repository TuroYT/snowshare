import { decrypt } from "@/lib/crypto-link";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { logShareAccess } from "@/lib/access-log";
import {
  accessDeniedResponse,
  checkShareAvailability,
  consumeView,
  verifySharePassword,
} from "@/lib/share-access";
import { NextRequest } from "next/server";

const LINK_SELECT = {
  id: true,
  type: true,
  urlOriginal: true,
  password: true,
  expiresAt: true,
  maxViews: true,
  viewCount: true,
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // support /s?slug=... and /s/<slug>
  let slug = url.searchParams.get("slug");
  if (!slug) {
    const parts = url.pathname.split("/").filter(Boolean); // ["s", "<slug>"] or ["s"]
    if (parts.length >= 2) slug = parts[1];
  }

  if (!slug) return apiError(request, ErrorCode.MISSING_DATA);

  try {
    const share = await prisma.share.findUnique({ where: { slug }, select: LINK_SELECT });
    if (!share) return apiError(request, ErrorCode.SHARE_NOT_FOUND);

    const unavailable = checkShareAvailability(share);
    if (unavailable) return accessDeniedResponse(request, unavailable);

    if (share.type !== "URL") {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    if (share.password) {
      // Relative redirect: the browser resolves it against the public origin it used,
      // so forwarded Host headers never influence the target
      return new Response(null, {
        status: 302,
        headers: { Location: `/l/${encodeURIComponent(slug)}/private` },
      });
    }
    if (!share.urlOriginal) return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);

    if (!(await consumeView(share.id))) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    void logShareAccess(request, share.id);

    return Response.redirect(share.urlOriginal, 302);
  } catch (error) {
    console.error("Error resolving link share:", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(request, ErrorCode.INVALID_JSON);
  }

  const slug = body?.slug;
  const password = body?.password;
  if (!slug || typeof slug !== "string") return apiError(request, ErrorCode.MISSING_DATA);
  if (!password || typeof password !== "string")
    return apiError(request, ErrorCode.PASSWORD_REQUIRED);

  try {
    const share = await prisma.share.findUnique({ where: { slug }, select: LINK_SELECT });
    if (!share || share.type !== "URL") return apiError(request, ErrorCode.SHARE_NOT_FOUND);

    const unavailable = checkShareAvailability(share);
    if (unavailable) return accessDeniedResponse(request, unavailable);

    const denied = await verifySharePassword(request, share, password);
    if (denied) return accessDeniedResponse(request, denied);

    let targetUrl = share.urlOriginal || "";
    if (share.password) {
      try {
        targetUrl = decrypt(targetUrl, password);
      } catch (error) {
        console.error("Failed to decrypt link share URL:", error);
        return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
      }
    }
    if (!targetUrl) return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);

    if (!(await consumeView(share.id))) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    void logShareAccess(request, share.id);

    return jsonResponse({ url: targetUrl });
  } catch (error) {
    console.error("Error verifying link password:", error);
    return internalError(request);
  }
}
