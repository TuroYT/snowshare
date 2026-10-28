/**
 * DELETE /api/user/reverse-shares/:id — Delete an upload request (session required, owner only).
 * Files already received stay in the owner's shares.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);

    const { id } = await params;
    const reverseShare = await prisma.reverseShare.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!reverseShare) return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
    if (reverseShare.ownerId !== session.user.id) return apiError(request, ErrorCode.FORBIDDEN);

    await prisma.reverseShare.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/user/reverse-shares/:id]", error);
    return internalError(request);
  }
}
