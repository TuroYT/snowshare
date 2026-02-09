import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";
import bcrypt from "bcryptjs";
import { isValidPasteLanguage, isValidUrl, MAX_PASTE_SIZE, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";

// DELETE - Supprimer un partage
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const share = await prisma.share.findUnique({
      where: { id: (await params).id },
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.ownerId !== session.user.id) {
      return apiError(request, ErrorCode.FORBIDDEN);
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
    return internalError(request);
  }
}

// PATCH - Modifier un partage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const share = await prisma.share.findUnique({
      where: { id: (await params).id },
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.ownerId !== session.user.id) {
      return apiError(request, ErrorCode.FORBIDDEN);
    }

    const data = await request.json();
    const { expiresAt, password, paste, pastelanguage, urlOriginal } = data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    
    // Hash password if provided, or set to null to remove
    if (password !== undefined) {
      if (password) {
        // Validate password length
        if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
          return apiError(request, ErrorCode.PASSWORD_INVALID_LENGTH, {
            min: PASSWORD_MIN_LENGTH,
            max: PASSWORD_MAX_LENGTH
          });
        }
        updateData.password = await bcrypt.hash(password, 12);
      } else {
        updateData.password = null;
      }
    }

    // Mise à jour spécifique selon le type
    if (share.type === "PASTE" && paste !== undefined) {
      // Validate paste content length to prevent DoS
      if (typeof paste !== 'string' || paste.length > MAX_PASTE_SIZE) {
        return apiError(request, ErrorCode.PASTE_CONTENT_REQUIRED);
      }
      updateData.paste = paste;
    }

    if (share.type === "PASTE" && pastelanguage !== undefined) {
      // Validate pastelanguage is a valid enum value
      if (!isValidPasteLanguage(pastelanguage)) {
        return apiError(request, ErrorCode.PASTE_LANGUAGE_INVALID);
      }
      updateData.pastelanguage = pastelanguage;
    }

    if (share.type === "URL" && urlOriginal !== undefined) {
      // Validate URL format and protocol
      const urlValidation = isValidUrl(urlOriginal);
      if (!urlValidation.valid) {
        return apiError(request, ErrorCode.INVALID_URL);
      }
      updateData.urlOriginal = urlOriginal;
    }

    const updatedShare = await prisma.share.update({
      where: { id: (await params).id },
      data: updateData,
    });

    return NextResponse.json({ share: updatedShare });
  } catch (error) {
    console.error("Error updating share:", error);
    return internalError(request);
  }
}
