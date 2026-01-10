import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// DELETE – Remove the link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    // Checking admin permissions
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    // Checking if the link exists
    const link = await prisma.customLink.findUnique({
      where: { id },
    })

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    await prisma.customLink.delete({
      where: { id },
    })

    return NextResponse.json(
      { message: "Link deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting custom link:", error)
    return NextResponse.json(
      { error: "Failed to delete custom link" },
      { status: 500 }
    )
  }
}
