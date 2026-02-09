import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";
import { isValidPasteLanguage, MAX_PASTE_SIZE, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import { ErrorCode } from "@/lib/api-errors";

export const createPasteShare = async (
  paste: string,
  pastelanguage: string,
  request: NextRequest,
  expiresAt?: Date,
  slug?: string,
  password?: string
) => {
  // Validate paste
  if (!paste || paste.length < 1) {
    return { errorCode: ErrorCode.PASTE_CONTENT_EMPTY };
  }

  // Validate paste size limit
  if (paste.length > MAX_PASTE_SIZE) {
    return { errorCode: ErrorCode.FILE_TOO_LARGE, params: { maxSizeMB: Math.round(MAX_PASTE_SIZE / (1024 * 1024)) } };
  }

  // Validate language against allowed enum values
  if (!pastelanguage || typeof pastelanguage !== "string" || !isValidPasteLanguage(pastelanguage)) {
    return { errorCode: ErrorCode.PASTE_LANGUAGE_INVALID };
  }

  // Validate slug if provided
  if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
    return { errorCode: ErrorCode.SLUG_INVALID };
  }

  // Check if slug already exists
  if (slug) {
    const existingShare = await prisma.share.findUnique({ where: { slug } });
    if (existingShare) {
      return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
    }
  }

  // Validate expiration date if provided
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return { errorCode: ErrorCode.EXPIRATION_IN_PAST };
  }

  if (password) {
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return {
        errorCode: ErrorCode.PASSWORD_INVALID_LENGTH,
        params: { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH }
      };
    }
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    // Check if anonymous paste sharing is allowed
    const settings = await prisma.settings.findFirst();
    if (settings && !settings.allowAnonPasteShare) {
      return { errorCode: ErrorCode.ANON_PASTE_SHARE_DISABLED };
    }

    // Check if expiry is greater than 7 days
    if (expiresAt) {
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 7);
      if (new Date(expiresAt) > maxExpiry) {
        return {
          errorCode: ErrorCode.EXPIRATION_TOO_FAR,
          params: { days: 7 }
        };
      }
    } else {
      return { errorCode: ErrorCode.EXPIRATION_REQUIRED };
    }
  }

  // Hash password if provided
  if (password) {
    password = await bcrypt.hash(password, 12);
  }

  // generate unique slug if not provided using cryptographically secure random
  if (!slug) {
    const generateSecureSlug = () => {
      return crypto.randomBytes(6).toString('base64url');
    };
    do {
      slug = generateSecureSlug();
    } while (await prisma.share.findUnique({ where: { slug } }));
  }

  // create the paste share
  const pasteShare = await prisma.share.create({
    data: {
      paste,
      pastelanguage: pastelanguage as import("@/generated/prisma/client").pasteType,
      expiresAt,
      slug,
      password: password || null,
      ownerId: session?.user?.id || null,
      type: "PASTE",
      ipSource: getClientIp(request),
    },
  });

  lookupIpGeolocation(getClientIp(request));

  return { pasteShare };
};
