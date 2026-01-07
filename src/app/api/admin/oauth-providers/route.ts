import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto-link"
import { getServerSession } from "next-auth"
import { getAuthOptions } from "@/lib/auth"

export async function GET() {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true }
  })

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const providers = await prisma.oAuthProvider.findMany({
    select: {
      id: true,
      name: true,
      displayName: true,
      enabled: true,
      clientId: true,
      updatedAt: true,
      // Never return clientSecret
    }
  })

  return NextResponse.json({ providers })
}

export async function POST(request: Request) {
  const authOptions = await getAuthOptions()
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true }
  })

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { name, displayName, enabled, clientId, clientSecret } = await request.json()

    // Encrypt secret if provided
    const encryptedSecret = clientSecret ? encrypt(clientSecret, process.env.NEXTAUTH_SECRET!) : undefined

    const provider = await prisma.oAuthProvider.upsert({
      where: { name },
      create: {
        name,
        displayName,
        enabled,
        clientId,
        clientSecret: encryptedSecret,
      },
      update: {
        displayName,
        enabled,
        clientId,
        ...(encryptedSecret && { clientSecret: encryptedSecret }),
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
    return NextResponse.json({ error: "Failed to save provider" }, { status: 500 })
  }
}
