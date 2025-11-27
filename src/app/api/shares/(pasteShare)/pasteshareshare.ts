import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";
import { isValidPasteLanguage, MAX_PASTE_SIZE } from "@/lib/constants";

export const createPasteShare = async (
  paste: string,
  pastelanguage: string,
  expiresAt?: Date,
  slug?: string,
  password?: string
) => {
  // Validate paste
  if (!paste || paste.length < 1) {
    return { error: "Le contenu du paste est requis." };
  }

  // Validate paste size limit
  if (paste.length > MAX_PASTE_SIZE) {
    return { error: "Le contenu du paste est trop volumineux (max 10MB)." };
  }

  // Validate language against allowed enum values
  if (!pastelanguage || typeof pastelanguage !== "string" || !isValidPasteLanguage(pastelanguage)) {
    return { error: "La langue du paste est invalide." };
  }

  // Validate slug if provided
  if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
    return { error: "Slug invalide. Il doit contenir entre 3 et 30 caractères alphanumériques, des tirets ou des underscores." };
  }

  // Validate expiration date if provided
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return { error: "La date d'expiration doit être dans le futur." };
  }

  if (password) {
    if (password.length < 6 || password.length > 100) {
      return { error: "Le mot de passe doit contenir entre 6 et 100 caractères." };
    }
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    // verif si expire supérieur à 7 jours
    if (expiresAt) {
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 7);
      if (new Date(expiresAt) > maxExpiry) {
        return { error: "Les utilisateurs non authentifiés ne peuvent pas créer de partages expirant au-delà de 7 jours." };
      }
    } else {
      return { error: "Les utilisateurs non authentifiés doivent fournir une date d'expiration." };
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

  // create the paste share
  const pasteShare = await prisma.share.create({
    data: {
      paste,
      pastelanguage: pastelanguage as import("@/generated/prisma").pasteType,
      expiresAt,
      slug,
      password: password || null,
      ownerId: session?.user?.id || null,
      type: "PASTE",
    },
  });

  return { pasteShare };
};
