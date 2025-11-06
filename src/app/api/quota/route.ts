import { NextRequest, NextResponse } from "next/server";
import { getQuotaInfo } from "@/lib/quota";

export async function GET(request: NextRequest) {
  try {
    const quotaInfo = await getQuotaInfo(request);
    return NextResponse.json(quotaInfo);
  } catch (error) {
    console.error("Error fetching quota info:", error);
    return NextResponse.json(
      { error: "Failed to fetch quota information" },
      { status: 500 }
    );
  }
}
