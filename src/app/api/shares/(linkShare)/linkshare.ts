import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/crypto-link";
import crypto from "crypto";
import { isValidUrl as validateUrl } from "@/lib/constants";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import { NextRequest } from "next/server";
import { ErrorCode } from "@/lib/api-errors";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/lib/constants";

export const createLinkShare = async (
    urlOriginal: string,
    request: NextRequest,
    expiresAt?: Date,
    slug?: string,
    password?: string
) => {
    // Check if slug already exists
    if (slug) {
        const existingShare = await prisma.share.findUnique({ where: { slug } });
        if (existingShare) {
            return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
        }
    }

    // Validate original URL format and protocol
    const urlValidation = validateUrl(urlOriginal);
    if (!urlValidation.valid) {
        return { errorCode: ErrorCode.INVALID_URL };
    }

    // Validate slug if provided
    if (slug && !/^[a-zA-Z0-9_-]{3,30}$/.test(slug)) {
        return { errorCode: ErrorCode.SLUG_INVALID };
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
        // Check if anonymous link sharing is allowed
        const settings = await prisma.settings.findFirst();
        if (settings && !settings.allowAnonLinkShare) {
            return { errorCode: ErrorCode.ANON_LINK_SHARE_DISABLED };
        }

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

    // Hash password and encrypt URL if password is provided
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

    lookupIpGeolocation(getClientIp(request));

    return { linkShare };
};
