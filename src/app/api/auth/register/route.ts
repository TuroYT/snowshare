import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isValidEmail, isValidPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants"
import { validateCaptcha } from "@/lib/captcha"
import { generateVerificationToken, sendVerificationEmail } from "@/lib/email"



export async function POST(request: NextRequest) {
  try {
    const { email, password, isFirstUser, captchaToken } = await request.json()
    
    // Check if this is the first user setup
    const userCount = await prisma.user.count()
    const isActuallyFirstUser = userCount === 0
    
    // Get DB settings
    let allowSignup = true // Default to true
    let disableCredentialsLogin = false
    let requireEmailVerification = false
    const settings = await prisma.settings.findFirst({
      select: {
        allowSignin: true,
        disableCredentialsLogin: true,
        requireEmailVerification: true
      }
    })
    
    if (settings) {
      allowSignup = settings.allowSignin
      disableCredentialsLogin = settings.disableCredentialsLogin
      requireEmailVerification = settings.requireEmailVerification ?? false
    }

    // Allow registration if:
    // 1. Settings allow signup (allowSignin), AND credentials login is NOT disabled
    // 2. OR This is the first user being created (database is empty)
    if ((!allowSignup || disableCredentialsLogin) && !isActuallyFirstUser) {
      return NextResponse.json(
        { error: "L'inscription est désactivée" },
        { status: 403 }
      )
    }

    // If claiming to be first user but database has users, reject
    if (isFirstUser && !isActuallyFirstUser) {
      return NextResponse.json(
        { error: "Des utilisateurs existent déjà" },
        { status: 403 }
      )
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Format d'email invalide" },
        { status: 400 }
      )
    }

    // Validate password length
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: `The password must contain between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Validate CAPTCHA if not first user (first user setup should be easy)
    if (!isActuallyFirstUser) {
      const captchaResult = await validateCaptcha(captchaToken)
      if (!captchaResult.success) {
        return NextResponse.json(
          { error: captchaResult.error || "CAPTCHA validation failed" },
          { status: 400 }
        )
      }
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      )
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12)

    // Generate email verification token if required
    let verificationToken: string | null = null
    let verificationExpires: Date | null = null
    
    if (requireEmailVerification && !isActuallyFirstUser) {
      verificationToken = generateVerificationToken()
      verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        isAdmin: isActuallyFirstUser ? true : false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        emailVerified: requireEmailVerification && !isActuallyFirstUser ? null : new Date(),
      }
    })

    // Send verification email if required
    if (requireEmailVerification && !isActuallyFirstUser && verificationToken) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
        await sendVerificationEmail(email, verificationToken, baseUrl)
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError)
        // Don't fail registration if email fails, but log the error
        // User can request a new verification email later
      }
    }

    return NextResponse.json({
      message: "Utilisateur créé avec succès",
      requiresVerification: requireEmailVerification && !isActuallyFirstUser,
      user: {
        id: user.id,
        email: user.email,
      }
    })
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error)
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
