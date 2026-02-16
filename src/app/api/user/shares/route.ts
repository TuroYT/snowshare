import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Récupérer tous les partages de l'utilisateur
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const shares = await prisma.share.findMany({
      where: {
        ownerId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ shares });
  } catch (error) {
    console.error("Error fetching user shares:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des partages" }, { status: 500 });
  }
}
