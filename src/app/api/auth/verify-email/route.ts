import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token) {
      return apiError(request, ErrorCode.TOKEN_REQUIRED);
    }
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const identifier = `email-verify:${email}`;

    const verificationToken = await prisma.verificationToken.findFirst({
      where: { identifier, token },
    });

    if (!verificationToken) {
      return apiError(request, ErrorCode.TOKEN_INVALID_OR_EXPIRED);
    }

    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      return apiError(request, ErrorCode.TOKEN_EXPIRED);
    }

    // Mark the user's email as verified
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return apiError(request, ErrorCode.USER_NOT_FOUND);
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email verification error:", error);
    return internalError(request);
  }
}
