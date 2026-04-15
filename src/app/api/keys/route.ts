/**
 * GET  /api/keys — List own API keys (session required)
 * POST /api/keys — Create a new API key (session required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/security";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: keys });
  } catch (error) {
    console.error("[GET /api/keys]", error);
    return internalError(request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError(request, ErrorCode.AUTHENTICATION_REQUIRED);

    let body: { name?: string; expiresAt?: string };
    try {
      body = await request.json();
    } catch {
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    const { name, expiresAt: expiresAtRaw } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return apiError(request, ErrorCode.MISSING_DATA);
    }
    if (name.trim().length > 64) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }

    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return apiError(request, ErrorCode.INVALID_REQUEST);
    }
    if (expiresAt && expiresAt <= new Date()) {
      return apiError(request, ErrorCode.EXPIRATION_IN_PAST);
    }

    const keyCount = await prisma.apiKey.count({ where: { userId: session.user.id } });
    if (keyCount >= 20) {
      return apiError(request, ErrorCode.QUOTA_EXCEEDED);
    }

    const { raw, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        userId: session.user.id,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ apiKey, token: raw }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/keys]", error);
    return internalError(request);
  }
}
