import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const userId = session.user.id;

    const [user, shares, apiKeys, accounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          defaultTab: true,
          ssoAutoLink: true,
        },
      }),
      prisma.share.findMany({
        where: { ownerId: userId },
        select: {
          type: true,
          slug: true,
          paste: true,
          pastelanguage: true,
          urlOriginal: true,
          createdAt: true,
          expiresAt: true,
          isBulk: true,
          maxViews: true,
          viewCount: true,
          files: {
            select: {
              originalName: true,
              relativePath: true,
              size: true,
              mimeType: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.apiKey.findMany({
        where: { userId },
        select: {
          name: true,
          keyPrefix: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      }),
      prisma.account.findMany({
        where: { userId },
        select: {
          provider: true,
          type: true,
        },
      }),
    ]);

    if (!user) {
      return apiError(request, ErrorCode.USER_NOT_FOUND);
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: user,
      shares: shares.map((s) => ({
        ...s,
        files: s.files.map((f) => ({ ...f, size: f.size.toString() })),
      })),
      apiKeys,
      connectedAccounts: accounts,
    };

    const filename = `snowshare-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating data export:", error);
    return internalError(request);
  }
}
