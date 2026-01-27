import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
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
    let settings = await prisma.settings.findFirst()

    // Create default settings if not exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          requireEmailVerification: false,
          captchaEnabled: false,
        }
      })
    }

    return NextResponse.json({
      requireEmailVerification: settings.requireEmailVerification ?? false,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure ?? true,
      smtpUser: settings.smtpUser,
      smtpPassword: settings.smtpPassword ? "********" : null, // Mask password
      smtpFromEmail: settings.smtpFromEmail,
      smtpFromName: settings.smtpFromName,
      captchaEnabled: settings.captchaEnabled ?? false,
      captchaProvider: settings.captchaProvider,
      captchaSiteKey: settings.captchaSiteKey,
      captchaSecretKey: settings.captchaSecretKey ? "********" : null, // Mask secret key
    })
  } catch (error) {
    console.error("Error fetching security settings:", error)
    return NextResponse.json({ error: "Failed to fetch security settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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
    const data = await request.json()

    let settings = await prisma.settings.findFirst()

    const updateData: Record<string, unknown> = {}

    // Email verification
    if (data.requireEmailVerification !== undefined) {
      updateData.requireEmailVerification = data.requireEmailVerification
    }

    // SMTP settings
    if (data.smtpHost !== undefined) updateData.smtpHost = data.smtpHost
    if (data.smtpPort !== undefined) updateData.smtpPort = data.smtpPort
    if (data.smtpSecure !== undefined) updateData.smtpSecure = data.smtpSecure
    if (data.smtpUser !== undefined) updateData.smtpUser = data.smtpUser
    if (data.smtpFromEmail !== undefined) updateData.smtpFromEmail = data.smtpFromEmail
    if (data.smtpFromName !== undefined) updateData.smtpFromName = data.smtpFromName
    
    // Only update password if it's not the masked value
    if (data.smtpPassword !== undefined && data.smtpPassword !== "********") {
      updateData.smtpPassword = data.smtpPassword
    }

    // CAPTCHA settings
    if (data.captchaEnabled !== undefined) updateData.captchaEnabled = data.captchaEnabled
    if (data.captchaProvider !== undefined) updateData.captchaProvider = data.captchaProvider
    if (data.captchaSiteKey !== undefined) updateData.captchaSiteKey = data.captchaSiteKey
    
    // Only update secret key if it's not the masked value
    if (data.captchaSecretKey !== undefined && data.captchaSecretKey !== "********") {
      updateData.captchaSecretKey = data.captchaSecretKey
    }

    if (!settings) {
      settings = await prisma.settings.create({
        data: updateData
      })
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: updateData
      })
    }

    // Return masked passwords
    return NextResponse.json({
      requireEmailVerification: settings.requireEmailVerification,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser,
      smtpPassword: settings.smtpPassword ? "********" : null,
      smtpFromEmail: settings.smtpFromEmail,
      smtpFromName: settings.smtpFromName,
      captchaEnabled: settings.captchaEnabled,
      captchaProvider: settings.captchaProvider,
      captchaSiteKey: settings.captchaSiteKey,
      captchaSecretKey: settings.captchaSecretKey ? "********" : null,
    })
  } catch (error) {
    console.error("Error updating security settings:", error)
    return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 })
  }
}
