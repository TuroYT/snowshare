import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto-link"
import { getServerSession } from "next-auth"
import { getAuthOptions } from "@/lib/auth"
import { isValidDisplayName } from "@/lib/validation"
import { apiError, internalError, ErrorCode } from "@/lib/api-errors"

export async function GET(request: NextRequest) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true }
  })

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY)
  }

  const providers = await prisma.oAuthProvider.findMany({
    select: {
      id: true,
      name: true,
      displayName: true,
      enabled: true,
      clientId: true,
      issuer: true,
      tenantId: true,
      updatedAt: true,
      // Never return clientSecret
    }
  })

  return NextResponse.json({ providers })
}

export async function POST(request: NextRequest) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return apiError(request, ErrorCode.UNAUTHORIZED)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true }
  })

  if (!user?.isAdmin) {
    return apiError(request, ErrorCode.ADMIN_ONLY)
  }

  try {
    const { name, displayName, enabled, clientId, clientSecret, issuer, tenantId } = await request.json()

    // Validate displayName
    const dnValidation = isValidDisplayName(displayName)
    if (!dnValidation.valid) {
      return apiError(request, ErrorCode.INVALID_DISPLAY_NAME)
    }
    const safeDisplayName = (displayName as string).trim()

    // Ensure NEXTAUTH_SECRET is available when encrypting client secrets
    if (clientSecret && !process.env.NEXTAUTH_SECRET) {
      console.error("Missing NEXTAUTH_SECRET while attempting to encrypt an OAuth provider clientSecret")
      return apiError(request, ErrorCode.SERVER_CONFIG_ERROR)
    }

    // Encrypt secret if provided
    const secretKey = process.env.NEXTAUTH_SECRET
    const encryptedSecret = clientSecret && secretKey ? encrypt(clientSecret, secretKey) : undefined

    const provider = await prisma.oAuthProvider.upsert({
      where: { name },
      create: {
        name,
        displayName: safeDisplayName,
        enabled,
        clientId,
        clientSecret: encryptedSecret,
        issuer,
        tenantId,
      },
      update: {
        displayName: safeDisplayName,
        enabled,
        clientId,
        ...(encryptedSecret && { clientSecret: encryptedSecret }),
        issuer,
        tenantId,
      },
    })

    return NextResponse.json({ 
      provider: {
        id: provider.id,
        name: provider.name,
        displayName: provider.displayName,
        enabled: provider.enabled,
        clientId: provider.clientId,
        updatedAt: provider.updatedAt
      }
    })
  } catch (error) {
    console.error("Error saving provider:", error)
    return internalError(request)
  }
}
