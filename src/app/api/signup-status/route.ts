import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get settings from database
    let allowSignin = true; // Default value
    const settings = await prisma.settings.findFirst({
      select: {
        allowSignin: true,
      },
    });

    if (settings) {
      allowSignin = settings.allowSignin;
    }

    return NextResponse.json({
      allowSignin,
    });
  } catch (error) {
    console.error("Error fetching signup status:", error);
    return NextResponse.json(
      { allowSignin: true }, // Default to true on error
      { status: 200 }
    );
  }
}
