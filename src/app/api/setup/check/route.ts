import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const USER_COUNT = await prisma.user.count()
    const NEED_SETUP = USER_COUNT === 0

    if (NEED_SETUP) {
      await prisma.settings.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1
        }
      })
    }
    
    return NextResponse.json({
      needsSetup: NEED_SETUP
    })
  } catch (error) {
    console.error("Error checking setup status:", error)
    return NextResponse.json(
      { error: "Failed to check setup status" },
      { status: 500 }
    )
  }
}
