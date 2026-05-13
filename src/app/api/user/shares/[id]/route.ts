import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage";
import {
  isValidPasteLanguage,
  isValidUrl,
  MAX_PASTE_SIZE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { hashPassword } from "@/lib/security";
import { Prisma, Share, $Enums } from "@/generated/prisma";

async function buildShareUpdateData(
  request: NextRequest,
  share: Share,
  data: {
    expiresAt?: unknown;
    password?: unknown;
    paste?: unknown;
    pastelanguage?: unknown;
    urlOriginal?: unknown;
  }
): Promise<Prisma.ShareUpdateInput | NextResponse> {
  const updateData: Prisma.ShareUpdateInput = {};

  if (data.expiresAt !== undefined) {
    updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt as string) : null;
  }

  if (data.password !== undefined) {
    if (data.password) {
      const pw = data.password as string;
      if (pw.length < PASSWORD_MIN_LENGTH || pw.length > PASSWORD_MAX_LENGTH) {
        return apiError(request, ErrorCode.PASSWORD_INVALID_LENGTH, {
          min: PASSWORD_MIN_LENGTH,
          max: PASSWORD_MAX_LENGTH,
        });
      }
      updateData.password = await hashPassword(pw);
    } else {
      updateData.password = null;
    }
  }

  if (share.type === "PASTE" && data.paste !== undefined) {
    if (typeof data.paste !== "string" || data.paste.length > MAX_PASTE_SIZE) {
      return apiError(request, ErrorCode.PASTE_CONTENT_REQUIRED);
    }
    updateData.paste = data.paste;
  }

  if (share.type === "PASTE" && data.pastelanguage !== undefined) {
    if (!isValidPasteLanguage(data.pastelanguage as string)) {
      return apiError(request, ErrorCode.PASTE_LANGUAGE_INVALID);
    }
    updateData.pastelanguage = data.pastelanguage as $Enums.pasteType;
  }

  if (share.type === "URL" && data.urlOriginal !== undefined) {
    const urlValidation = isValidUrl(data.urlOriginal as string);
    if (!urlValidation.valid) {
      return apiError(request, ErrorCode.INVALID_URL);
    }
    updateData.urlOriginal = data.urlOriginal as string;
  }

  return updateData;
}

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

    if (share.type === "FILE" && share.filePath) {
      try {
        await deleteFromStorage(share.filePath);
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
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const updateDataOrError = await buildShareUpdateData(request, share, data);
    if (updateDataOrError instanceof NextResponse) return updateDataOrError;

    const updatedShare = await prisma.share.update({
      where: { id: (await params).id },
      data: updateDataOrError,
    });

    return NextResponse.json({ share: updatedShare });
  } catch (error) {
    console.error("Error updating share:", error);
    return internalError(request);
  }
}
