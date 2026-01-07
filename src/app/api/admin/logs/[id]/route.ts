import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadDir } from "@/lib/constants";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!currentUser?.isAdmin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id: shareId } = await params;

    const share = await prisma.share.findUnique({
      where: { id: shareId },
      select: { id: true, type: true, filePath: true, slug: true },
    });
    if (!share) {
      return NextResponse.json({ error: "Partage non trouvé" }, { status: 404 });
    }

    if (share.type === "FILE" && share.filePath) {
      try {
        const uploadDir = getUploadDir();
        const filePath = path.join(uploadDir, share.filePath);
        await unlink(filePath);
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }

    await prisma.share.delete({ where: { id: share.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting share (admin):", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}
