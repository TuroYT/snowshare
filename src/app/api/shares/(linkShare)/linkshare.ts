import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/crypto-link";
import crypto from "crypto";
import { isValidUrl as validateUrl } from "@/lib/constants";
import { getClientIp } from "@/lib/getClientIp";
import { NextRequest } from "next/server";

export const createLinkShare = async (
    urlOriginal: string,
    request: NextRequest,
    expiresAt?: Date,
    slug?: string,
    password?: string
) => {
    // Validate original URL format and protocol
    const urlValidation = validateUrl(urlOriginal);
    if (!urlValidation.valid) {
        return { error: urlValidation.error || "Invalid original URL" };
    }

    // Validate slug if provided
    if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
        return {
            error: "Invalid slug. It must contain between 3 and 30 alphanumeric characters, dashes or underscores."
        };
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
        
        if (expiresAt) {
            const maxExpiry = new Date();
            maxExpiry.setDate(maxExpiry.getDate() + 7);
            if (new Date(expiresAt) > maxExpiry) {
                return {
                    error: "Unauthenticated users cannot create shares that expire beyond 7 days."
                };
            }
        } else {
            return { error: "Unauthenticated users must provide an expiration date." };
        }
    }

    // hash password et chiffrer l'URL si password fourni
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 12);
        urlOriginal = encrypt(urlOriginal, password);
        password = hashedPassword;
    }

    // generate unique slug if not provided using cryptographically secure random
    if (!slug) {
        const generateSecureSlug = () => {
            return crypto.randomBytes(6).toString("base64url");
        };
        do {
            slug = generateSecureSlug();
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
            ipSource: getClientIp(request)
        }
    });

    return { linkShare };
};
