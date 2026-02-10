import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { maskSecret, unmaskSecret } from "@/lib/secret-masking"
import { securitySettingsSchema } from "@/lib/validation-schemas"

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
      smtpPassword: maskSecret(settings.smtpPassword, "smtp-password"),
      smtpFromEmail: settings.smtpFromEmail,
      smtpFromName: settings.smtpFromName,
      captchaEnabled: settings.captchaEnabled ?? false,
      captchaProvider: settings.captchaProvider,
      captchaSiteKey: settings.captchaSiteKey,
      captchaSecretKey: maskSecret(settings.captchaSecretKey, "captcha-secret"),
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
    const body = await request.json()
    
    // Validate input with Zod
    const validation = securitySettingsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.format() },
        { status: 400 }
      )
    }
    
    const data = validation.data
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
    
    // Unmask password - keep original if masked sentinel provided
    if (data.smtpPassword !== undefined) {
      updateData.smtpPassword = unmaskSecret(
        data.smtpPassword,
        "smtp-password",
        settings?.smtpPassword || null
      )
    }

    // CAPTCHA settings
    if (data.captchaEnabled !== undefined) updateData.captchaEnabled = data.captchaEnabled
    if (data.captchaProvider !== undefined) updateData.captchaProvider = data.captchaProvider
    if (data.captchaSiteKey !== undefined) updateData.captchaSiteKey = data.captchaSiteKey
    
    // Unmask secret key - keep original if masked sentinel provided
    if (data.captchaSecretKey !== undefined) {
      updateData.captchaSecretKey = unmaskSecret(
        data.captchaSecretKey,
        "captcha-secret",
        settings?.captchaSecretKey || null
      )
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

    // Return masked secrets
    return NextResponse.json({
      requireEmailVerification: settings.requireEmailVerification,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser,
      smtpPassword: maskSecret(settings.smtpPassword, "smtp-password"),
      smtpFromEmail: settings.smtpFromEmail,
      smtpFromName: settings.smtpFromName,
      captchaEnabled: settings.captchaEnabled,
      captchaProvider: settings.captchaProvider,
      captchaSiteKey: settings.captchaSiteKey,
      captchaSecretKey: maskSecret(settings.captchaSecretKey, "captcha-secret"),
    })
  } catch (error) {
    console.error("Error updating security settings:", error)
    return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 })
  }
}
