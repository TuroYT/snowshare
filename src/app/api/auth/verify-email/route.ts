import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: "Token de vérification requis" },
        { status: 400 }
      )
    }

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gte: new Date()
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "Token de vérification invalide ou expiré" },
        { status: 400 }
      )
    }

    // Update user - mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }
    })

    return NextResponse.json({
      message: "Email vérifié avec succès",
      success: true
    })
  } catch (error) {
    console.error("Erreur lors de la vérification de l'email:", error)
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// Resend verification email
export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      )
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email déjà vérifié" },
        { status: 400 }
      )
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      }
    })

    // Send verification email
    const { sendVerificationEmail } = await import("@/lib/email")
    const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    
    try {
      await sendVerificationEmail(email, verificationToken, baseUrl)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      return NextResponse.json(
        { error: "Échec de l'envoi de l'email de vérification. Veuillez vérifier la configuration SMTP." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Email de vérification renvoyé avec succès",
      success: true
    })
  } catch (error) {
    console.error("Erreur lors du renvoi de l'email de vérification:", error)
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
