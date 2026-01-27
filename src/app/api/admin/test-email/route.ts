import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { sendTestEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 })
    }

    await sendTestEmail(email)

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully"
    })
  } catch (error) {
    const err = error as Error
    console.error("Error sending test email:", error)
    return NextResponse.json({
      error: err.message || "Failed to send test email"
    }, { status: 500 })
  }
}
