import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";
import { isValidPasteLanguage, MAX_PASTE_SIZE } from "@/lib/constants";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/getClientIp";
import { getIpLocation } from "@/lib/ipGeolocation";

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
    return { error: "Paste content is required." };
  }

  // Validate paste size limit
  if (paste.length > MAX_PASTE_SIZE) {
    return { error: "Paste content is too large (max 10MB)." };
  }

  // Validate language against allowed enum values
  if (!pastelanguage || typeof pastelanguage !== "string" || !isValidPasteLanguage(pastelanguage)) {
    return { error: "Paste language is invalid." };
  }

  // Validate slug if provided
  if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
    return { error: "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores." };
  }

  // Validate expiration date if provided
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return { error: "Expiration date must be in the future." };
  }

  if (password) {
    if (password.length < 6 || password.length > 100) {
      return { error: "Password must be between 6 and 100 characters." };
    }
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    // verif si expire supérieur à 7 jours
    if (expiresAt) {
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 7);
      if (new Date(expiresAt) > maxExpiry) {
        return { error: "Unauthenticated users cannot create shares that expire beyond 7 days." };
      }
    } else {
      return { error: "Unauthenticated users must provide an expiration date." };
    }
  }

  // hash password si fourni
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

  // Fetch IP location data (don't fail if geolocation fails)
  const clientIp = getClientIp(request);
  let ipLocation = null;
  try {
    ipLocation = await getIpLocation(clientIp);
  } catch (error) {
    console.error('Failed to fetch IP location for IP:', clientIp, error);
    // Continue with null location - share creation should not fail
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
      ipSource: clientIp,
      ipCountry: ipLocation?.country || null,
      ipCountryCode: ipLocation?.countryCode || null,
      ipRegion: ipLocation?.regionName || null,
      ipCity: ipLocation?.city || null,
    },
  });

  return { pasteShare };
};
