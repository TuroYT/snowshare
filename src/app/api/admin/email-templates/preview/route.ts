import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { renderShareEmail, renderVerifyEmail } from "@/lib/email-templates";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED);
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY);
  }

  try {
    const data = await request.json();
    const { type, subject, html, text } = data as {
      type: "share" | "verify";
      subject?: string | null;
      html?: string | null;
      text?: string | null;
    };

    const settings = await prisma.settings.findFirst({
      select: { appName: true },
    });
    const appName = settings?.appName || "SnowShare";

    if (type === "share") {
      const result = renderShareEmail(
        {
          appName,
          shareTitle: "example-file.pdf",
          shareUrl: "https://example.com/f/abc123",
        },
        { subject, html, text }
      );
      return NextResponse.json({ preview: result });
    } else if (type === "verify") {
      const result = renderVerifyEmail(
        {
          appName,
          verifyUrl:
            "https://example.com/auth/verify-email?token=example-token&email=user%40example.com",
        },
        { subject, html, text }
      );
      return NextResponse.json({ preview: result });
    }

    return apiError(request, ErrorCode.INVALID_REQUEST);
  } catch (error) {
    console.error("Error rendering email preview:", error);
    return internalError(request);
  }
}
