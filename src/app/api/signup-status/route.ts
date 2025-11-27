import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get settings from database
    let allowSignup = true; // Default value
    const settings = await prisma.settings.findFirst({
      select: {
        allowSignin: true,
      },
    });

    if (settings) {
      allowSignup = settings.allowSignin;
    }

    return NextResponse.json({
      allowSignup,
    });
  } catch (error) {
    console.error("Error fetching signup status:", error);
    return NextResponse.json(
      { allowSignup: true }, // Default to true on error
      { status: 200 }
    );
  }
}
