import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendShareEmail, isEmailEnabled } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emailEnabled = await isEmailEnabled();
  if (!emailEnabled) {
    return NextResponse.json({ error: "Email sending is not configured" }, { status: 503 });
  }

  const body = await request.json();
  const { slug, recipients } = body;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
  }

  const invalidEmail = recipients.find(
    (r: unknown) => typeof r !== "string" || !EMAIL_REGEX.test(r)
  );
  if (invalidEmail !== undefined) {
    return NextResponse.json(
      { error: "One or more recipient email addresses are invalid" },
      { status: 400 }
    );
  }

  const share = await prisma.share.findUnique({ where: { slug } });
  if (!share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const prefix = share.shareType === "FILE" ? "f" : share.shareType === "PASTE" ? "p" : "l";
  const shareUrl = `${baseUrl}/${prefix}/${slug}`;

  await sendShareEmail(shareUrl, slug, recipients);

  return NextResponse.json({ message: "Email sent successfully" });
}
