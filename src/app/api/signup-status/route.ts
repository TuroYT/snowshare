import { NextResponse } from "next/server";
import { getSettingsCached } from "@/lib/settings";

export async function GET() {
  try {
    // Get settings from database
    let allowSignup = true; // Default value
    const settings = await getSettingsCached();

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
