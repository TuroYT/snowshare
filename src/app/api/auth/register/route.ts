import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isValidEmail, isValidPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants"



export async function POST(request: NextRequest) {
  try {
    const { email, password, isFirstUser } = await request.json()
    
    // Check if this is the first user setup
    const userCount = await prisma.user.count()
    const isActuallyFirstUser = userCount === 0
    
    // Get DB settings
    let allowSignup = true // Default to true
    const settings = await prisma.settings.findFirst({
      select: {
        allowSignin: true
      }
    })
    
    if (settings) {
      allowSignup = settings.allowSignin
    }

    // Allow registration if:
    // 1. Settings allow signup (allowSignin), OR
    // 2. This is the first user being created (database is empty)
    if (!allowSignup && !isActuallyFirstUser) {
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
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
