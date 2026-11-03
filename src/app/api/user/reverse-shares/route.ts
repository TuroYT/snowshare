/**
 * GET  /api/user/reverse-shares — List own upload requests (session required)
 * POST /api/user/reverse-shares — Create an upload request (session required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import {
  createReverseShare,
  toOwnerReverseShare,
  validateReverseShareInput,
} from "@/lib/reverse-shares";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);

    const rows = await prisma.reverseShare.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: rows.map(toOwnerReverseShare) });
  } catch (error) {
    console.error("[GET /api/user/reverse-shares]", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    const validated = validateReverseShareInput(body);
    if (validated.errorCode) return apiError(request, validated.errorCode);

    const { errorCode, reverseShare } = await createReverseShare(session.user.id, validated.data);
    if (errorCode) return apiError(request, errorCode);

    return NextResponse.json({ data: toOwnerReverseShare(reverseShare!) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/user/reverse-shares]", error);
    return internalError(request);
  }
}
