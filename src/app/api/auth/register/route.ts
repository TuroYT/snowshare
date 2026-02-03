import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isValidEmail, isValidPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants"
import { apiError, internalError, ErrorCode } from "@/lib/api-errors"



export async function POST(request: NextRequest) {
  try {
    const { email, password, isFirstUser } = await request.json()
    
    // Check if this is the first user setup
    const userCount = await prisma.user.count()
    const isActuallyFirstUser = userCount === 0
    
    // Get DB settings
    let allowSignup = true // Default to true
    let disableCredentialsLogin = false
    const settings = await prisma.settings.findFirst({
      select: {
        allowSignin: true,
        disableCredentialsLogin: true
      }
    })
    
    if (settings) {
      allowSignup = settings.allowSignin
      disableCredentialsLogin = settings.disableCredentialsLogin
    }

    // Allow registration if:
    // 1. Settings allow signup (allowSignin), AND credentials login is NOT disabled
    // 2. OR This is the first user being created (database is empty)
    if ((!allowSignup || disableCredentialsLogin) && !isActuallyFirstUser) {
      return apiError(request, ErrorCode.SIGNUP_DISABLED)
    }

    // If claiming to be first user but database has users, reject
    if (isFirstUser && !isActuallyFirstUser) {
      return apiError(request, ErrorCode.USERS_ALREADY_EXIST)
    }

    if (!email || !password) {
      return apiError(request, ErrorCode.EMAIL_PASSWORD_REQUIRED)
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return apiError(request, ErrorCode.INVALID_EMAIL_FORMAT)
    }

    // Validate password length
    if (!isValidPassword(password)) {
      return apiError(request, ErrorCode.PASSWORD_LENGTH, {
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH
      })
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return apiError(request, ErrorCode.USER_ALREADY_EXISTS)
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12)

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        isAdmin: isActuallyFirstUser ? true : false,
      }
    })

    return NextResponse.json({
      message: "Utilisateur créé avec succès",
      user: {
        id: user.id,
        email: user.email,
      }
    })
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error)
    return internalError(request)
  }
}
