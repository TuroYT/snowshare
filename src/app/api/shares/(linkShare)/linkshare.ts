import { Share } from './../../../../generated/prisma/index.d';
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Utility function to validate URLs
function isValidUrl(url: string) {
  const pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
      "((([a-z0-9\\-]+\\.)+[a-z]{2,})|" + // domain name
      "localhost|" + // localhost
      "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|" + // IP address
      "\\[?[a-f0-9:\\.]+\\]?)" + // IPv6
      "(\\:\\d+)?(\\/[^\\s]*)?$",
    "i"
  );
  return pattern.test(url);
}

export const createLinkShare = async (
  urlOriginal: string,
  expiresAt?: Date,
  slug?: string,
  password?: string
)  => {
    // Validate original URL
    if (!urlOriginal || !isValidUrl(urlOriginal)) {
        return { error: "URL originale invalide" };
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

    const session = await getServerSession();
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

    // hash password and link if provided
    if (password) {
        password = await bcrypt.hash(password, 12);
        urlOriginal = await bcrypt.hash(urlOriginal, 12);
    }

    // generate unique slug if not provided
    if (!slug) {
        const generateSlug = () => {
            return Math.random().toString(36).substring(2, 8);
        };
        do {
            slug = generateSlug();
        } while (await prisma.share.findUnique({ where: { slug } }));
    }

    // create the link share
    const linkShare = await prisma.share.create({
        data: {
            urlOriginal,
            expiresAt,
            slug,
            password: password || null,
            ownerId: session?.user?.id || null,
            type: "URL",
        },
    });

    return { linkShare };
};
