import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    let settings = await prisma.settings.findFirst();
    
    // Create default settings if not exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          allowSignin: true,
          allowAnonFileShare: true,
          anoMaxUpload: 2048,
          authMaxUpload: 51200,
          anoIpQuota: 4096,
          authIpQuota: 102400,
                  },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await request.json();

    let settings = await prisma.settings.findFirst();
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          allowSignin: data.allowSignin !== undefined ? data.allowSignin : true,
          allowAnonFileShare: data.allowAnonFileShare !== undefined ? data.allowAnonFileShare : true,
          anoMaxUpload: data.anoMaxUpload || 2048,
          authMaxUpload: data.authMaxUpload || 51200,
          anoIpQuota: data.anoIpQuota || 4096,
          authIpQuota: data.authIpQuota || 102400,
          appName: data.appName || "SnowShare",
          appDescription: data.appDescription || "Share your files, pastes and URLs securely",
          logoUrl: data.logoUrl || null,
          faviconUrl: data.faviconUrl || null,
          primaryColor: data.primaryColor || "#3B82F6",
          primaryHover: data.primaryHover || "#2563EB",
          primaryDark: data.primaryDark || "#1E40AF",
          secondaryColor: data.secondaryColor || "#8B5CF6",
          secondaryHover: data.secondaryHover || "#7C3AED",
          secondaryDark: data.secondaryDark || "#6D28D9",
          backgroundColor: data.backgroundColor || "#111827",
          surfaceColor: data.surfaceColor || "#1F2937",
          textColor: data.textColor || "#F9FAFB",
          textMuted: data.textMuted || "#D1D5DB",
          borderColor: data.borderColor || "#374151",
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          allowSignin: data.allowSignin !== undefined ? data.allowSignin : settings.allowSignin,
          allowAnonFileShare: data.allowAnonFileShare !== undefined ? data.allowAnonFileShare : settings.allowAnonFileShare,
          anoMaxUpload: data.anoMaxUpload || settings.anoMaxUpload,
          authMaxUpload: data.authMaxUpload || settings.authMaxUpload,
          anoIpQuota: data.anoIpQuota || settings.anoIpQuota,
          authIpQuota: data.authIpQuota || settings.authIpQuota,
          appName: data.appName !== undefined ? data.appName : settings.appName,
          appDescription: data.appDescription !== undefined ? data.appDescription : settings.appDescription,
          logoUrl: data.logoUrl !== undefined ? data.logoUrl : settings.logoUrl,
          faviconUrl: data.faviconUrl !== undefined ? data.faviconUrl : settings.faviconUrl,
          primaryColor: data.primaryColor !== undefined ? data.primaryColor : settings.primaryColor,
          primaryHover: data.primaryHover !== undefined ? data.primaryHover : settings.primaryHover,
          primaryDark: data.primaryDark !== undefined ? data.primaryDark : settings.primaryDark,
          secondaryColor: data.secondaryColor !== undefined ? data.secondaryColor : settings.secondaryColor,
          secondaryHover: data.secondaryHover !== undefined ? data.secondaryHover : settings.secondaryHover,
          secondaryDark: data.secondaryDark !== undefined ? data.secondaryDark : settings.secondaryDark,
          backgroundColor: data.backgroundColor !== undefined ? data.backgroundColor : settings.backgroundColor,
          surfaceColor: data.surfaceColor !== undefined ? data.surfaceColor : settings.surfaceColor,
          textColor: data.textColor !== undefined ? data.textColor : settings.textColor,
          textMuted: data.textMuted !== undefined ? data.textMuted : settings.textMuted,
          borderColor: data.borderColor !== undefined ? data.borderColor : settings.borderColor,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
