import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteShareFiles } from "@/lib/storage";
import {
  isValidPasteLanguage,
  isValidUrl,
  MAX_PASTE_SIZE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/constants";
import { apiError, internalError, ErrorCode } from "@/lib/api-errors";
import { hashPassword } from "@/lib/security";
import { encrypt } from "@/lib/crypto-link";
import { toUserShare, USER_SHARE_SELECT } from "@/lib/user-shares";
import { Prisma, $Enums } from "@/generated/prisma";

type EditableShare = {
  type: $Enums.ShareType;
  password: string | null;
  urlOriginal: string | null;
};

type ShareUpdateBody = {
  expiresAt?: unknown;
  password?: unknown;
  paste?: unknown;
  pastelanguage?: unknown;
  urlOriginal?: unknown;
};

/** Returns the new expiration (Date or null), or an error response. */
function parseExpiresAt(request: NextRequest, value: unknown): Date | null | NextResponse {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return apiError(request, ErrorCode.INVALID_DATE_FORMAT);
  }
  return date;
}

/** Returns the new password (null removes it), or an error response. */
function parseNewPassword(request: NextRequest, value: unknown): string | null | NextResponse {
  if (!value) return null;
  if (typeof value !== "string") {
    return apiError(request, ErrorCode.INVALID_REQUEST);
  }
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return apiError(request, ErrorCode.PASSWORD_INVALID_LENGTH, {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    });
  }
  return value;
}

/** Applies the paste content and language changes, or returns an error response. */
function applyPasteUpdate(
  request: NextRequest,
  data: ShareUpdateBody,
  updateData: Prisma.ShareUpdateInput
): NextResponse | null {
  if (data.paste !== undefined) {
    if (typeof data.paste !== "string" || data.paste.length > MAX_PASTE_SIZE) {
      return apiError(request, ErrorCode.PASTE_CONTENT_REQUIRED);
    }
    updateData.paste = data.paste;
  }

  if (data.pastelanguage !== undefined) {
    if (!isValidPasteLanguage(data.pastelanguage as string)) {
      return apiError(request, ErrorCode.PASTE_LANGUAGE_INVALID);
    }
    updateData.pastelanguage = data.pastelanguage as $Enums.pasteType;
  }
  return null;
}

/** Validates the new destination URL of a link; undefined means "unchanged". */
function parseNewUrl(request: NextRequest, value: unknown): string | undefined | NextResponse {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !isValidUrl(value).valid) {
    return apiError(request, ErrorCode.INVALID_URL);
  }
  return value;
}

/** Re-encrypts the link URL when its URL or password changes, or returns an error response. */
function applyLinkUpdate(
  request: NextRequest,
  share: EditableShare,
  newUrl: string | undefined,
  newPassword: string | null | undefined,
  updateData: Prisma.ShareUpdateInput
): NextResponse | null {
  const wasProtected = !!share.password;

  if (wasProtected && newUrl === undefined) {
    // The plaintext URL is unknown: it cannot be re-encrypted or decrypted
    return apiError(request, ErrorCode.LINK_URL_REQUIRED_FOR_PASSWORD_CHANGE);
  }
  if (wasProtected && newPassword === undefined) {
    // The plaintext password is unknown: the new URL cannot be encrypted
    return apiError(request, ErrorCode.LINK_PASSWORD_REQUIRED_FOR_URL_CHANGE);
  }

  const targetUrl = newUrl ?? share.urlOriginal ?? "";
  const effectivePassword = newPassword ?? null;
  updateData.urlOriginal = effectivePassword ? encrypt(targetUrl, effectivePassword) : targetUrl;
  return null;
}

function applyTypeSpecificUpdate(
  request: NextRequest,
  share: EditableShare,
  data: ShareUpdateBody,
  newPassword: string | null | undefined,
  updateData: Prisma.ShareUpdateInput
): NextResponse | null {
  if (share.type === "PASTE") {
    return applyPasteUpdate(request, data, updateData);
  }

  if (share.type !== "URL") return null;

  const newUrl = parseNewUrl(request, data.urlOriginal);
  if (newUrl instanceof NextResponse) return newUrl;
  if (newUrl === undefined && newPassword === undefined) return null;

  return applyLinkUpdate(request, share, newUrl, newPassword, updateData);
}

/**
 * Builds the update from the PATCH body.
 *
 * `password`: undefined keeps the current password, "" or null removes it, a string sets it.
 * Password-protected links store their URL encrypted with the password, so changing the URL
 * or the password of such a link requires both the destination URL and the (new) password.
 */
async function buildShareUpdateData(
  request: NextRequest,
  share: EditableShare,
  data: ShareUpdateBody
): Promise<Prisma.ShareUpdateInput | NextResponse> {
  const updateData: Prisma.ShareUpdateInput = {};

  if (data.expiresAt !== undefined) {
    const expiresAt = parseExpiresAt(request, data.expiresAt);
    if (expiresAt instanceof NextResponse) return expiresAt;
    updateData.expiresAt = expiresAt;
  }

  let newPassword: string | null | undefined;
  if (data.password !== undefined) {
    const parsedPassword = parseNewPassword(request, data.password);
    if (parsedPassword instanceof NextResponse) return parsedPassword;
    newPassword = parsedPassword;
  }

  const typeError = applyTypeSpecificUpdate(request, share, data, newPassword, updateData);
  if (typeError) return typeError;

  if (newPassword !== undefined) {
    updateData.password = newPassword ? await hashPassword(newPassword) : null;
  }

  return updateData;
}

// DELETE - Delete a share and its stored files
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const { id } = await params;
    const share = await prisma.share.findUnique({
      where: { id },
      select: { ownerId: true, filePath: true, files: { select: { filePath: true } } },
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.ownerId !== session.user.id) {
      return apiError(request, ErrorCode.FORBIDDEN);
    }

    await deleteShareFiles(share);

    await prisma.share.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting share:", error);
    return internalError(request);
  }
}

// PATCH - Update a share
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError(request, ErrorCode.UNAUTHORIZED);
    }

    const { id } = await params;
    const share = await prisma.share.findUnique({
      where: { id },
      select: { ownerId: true, type: true, password: true, urlOriginal: true },
    });

    if (!share) {
      return apiError(request, ErrorCode.SHARE_NOT_FOUND);
    }

    if (share.ownerId !== session.user.id) {
      return apiError(request, ErrorCode.FORBIDDEN);
    }

    let data;
    try {
      data = await request.json();
    } catch (error) {
      console.error("Share update: invalid JSON body:", error);
      return apiError(request, ErrorCode.INVALID_JSON);
    }

    const updateDataOrError = await buildShareUpdateData(request, share, data);
    if (updateDataOrError instanceof NextResponse) return updateDataOrError;

    const updatedShare = await prisma.share.update({
      where: { id },
      data: updateDataOrError,
      select: USER_SHARE_SELECT,
    });

    return NextResponse.json({ share: toUserShare(updatedShare) });
  } catch (error) {
    console.error("Error updating share:", error);
    return internalError(request);
  }
}
