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
