import { NextResponse } from "next/server"
import { getPublicCaptchaConfig } from "@/lib/captcha"

export async function GET() {
  try {
    const config = await getPublicCaptchaConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error("Error fetching CAPTCHA config:", error)
    return NextResponse.json(
      { enabled: false, provider: null, siteKey: null },
      { status: 200 }
    )
  }
}
