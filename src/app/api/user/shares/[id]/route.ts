import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

// DELETE - Supprimer un partage
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const share = await prisma.share.findUnique({
      where: { id: (await params).id },
    });

    if (!share) {
      return NextResponse.json({ error: "Partage non trouvé" }, { status: 404 });
    }

    if (share.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Si c'est un fichier, le supprimer du système de fichiers
    if (share.type === "FILE" && share.filePath) {
      try {
        const filePath = join(process.cwd(), "uploads", share.filePath);
        await unlink(filePath);
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }

    await prisma.share.delete({
      where: { id: (await params).id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting share:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}

// PATCH - Modifier un partage
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const share = await prisma.share.findUnique({
      where: { id: (await params).id },
    });

    if (!share) {
      return NextResponse.json({ error: "Partage non trouvé" }, { status: 404 });
    }

    if (share.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const data = await req.json();
    const { expiresAt, password, paste, pastelanguage, urlOriginal } = data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    
    if (password !== undefined) {
      updateData.password = password || null;
    }

    // Mise à jour spécifique selon le type
    if (share.type === "PASTE" && paste !== undefined) {
      updateData.paste = paste;
    }

    if (share.type === "PASTE" && pastelanguage !== undefined) {
      updateData.pastelanguage = pastelanguage;
    }

    if (share.type === "URL" && urlOriginal !== undefined) {
      updateData.urlOriginal = urlOriginal;
    }

    const updatedShare = await prisma.share.update({
      where: { id: (await params).id },
      data: updateData,
    });

    return NextResponse.json({ share: updatedShare });
  } catch (error) {
    console.error("Error updating share:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
