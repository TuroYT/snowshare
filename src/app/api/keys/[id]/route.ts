/**
 * DELETE /api/keys/:id — Revoke an API key (session required, owner only)
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
    const apiKey = await prisma.apiKey.findUnique({ where: { id } });

    if (!apiKey) return apiError(request, ErrorCode.RESOURCE_NOT_FOUND);
    if (apiKey.userId !== session.user.id) return apiError(request, ErrorCode.FORBIDDEN);

    await prisma.apiKey.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/keys/:id]", error);
    return internalError(request);
  }
}
