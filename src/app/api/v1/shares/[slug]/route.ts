/**
 * GET    /api/v1/shares/:slug — Get share metadata
 * DELETE /api/v1/shares/:slug — Delete a share (owner or admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const share = await prisma.share.findUnique({
      where: { slug },
      select: {
        id: true,
        type: true,
        slug: true,
        expiresAt: true,
        createdAt: true,
        maxViews: true,
        viewCount: true,
        isBulk: true,
      },
    });

    if (!share) return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    if (share.expiresAt && share.expiresAt < new Date()) {
      return apiError(request, ErrorCode.SHARE_EXPIRED);
    }

    return NextResponse.json({ share });
  } catch (error) {
    console.error("[GET /api/v1/shares/:slug]", error);
    return internalError(request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await authenticateApiRequest(request);
    if (!user) return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);

    const { slug } = await params;
    const share = await prisma.share.findUnique({ where: { slug } });

    if (!share) return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    if (share.ownerId !== user.id && !user.isAdmin) {
      return apiError(request, ErrorCode.FORBIDDEN);
    }

    await prisma.share.delete({ where: { slug } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/v1/shares/:slug]", error);
    return internalError(request);
  }
}
