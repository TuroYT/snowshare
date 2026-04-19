/**
 * Shared share creation service.
 * Used by API routes, tus server, and frontend share endpoints.
 */

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto-link";
import {
  isValidUrl as validateUrl,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  isValidPasteLanguage,
  MAX_PASTE_SIZE,
} from "@/lib/constants";
import { getClientIp } from "@/lib/getClientIp";
import { lookupIpGeolocation } from "@/lib/ip-geolocation";
import {
  hashPassword,
  isValidSlug,
  resolveAnonExpiry,
  generateRandomSlug,
  MAX_ANON_EXPIRY_DAYS,
} from "@/lib/security";
import { ErrorCode } from "@/lib/api-errors";
import { NextRequest } from "next/server";
import type { pasteType } from "@/generated/prisma/client";

export interface ShareContext {
  /** The authenticated user's ID, or null for anonymous. */
  userId: string | null;
  /** Whether the request is authenticated (session or API key). */
  isAuthenticated: boolean;
  /** Client IP for quota tracking. */
  ip: string;
}

function getContextFromRequest(request: NextRequest, overrideUserId?: string | null): ShareContext {
  return {
    userId: overrideUserId ?? null,
    isAuthenticated: overrideUserId != null,
    ip: getClientIp(request),
  };
}

// ---------------------------------------------------------------------------
// Link share
// ---------------------------------------------------------------------------

export interface CreateLinkShareParams {
  urlOriginal: string;
  context: ShareContext;
  expiresAt?: Date;
  slug?: string;
  password?: string;
  maxViews?: number;
}

export async function createLinkShare(params: CreateLinkShareParams) {
  const { context, expiresAt, maxViews } = params;
  let { urlOriginal, slug, password } = params;

  // Validate URL
  const urlValidation = validateUrl(urlOriginal);
  if (!urlValidation.valid) {
    return { errorCode: ErrorCode.INVALID_URL };
  }

  // Validate slug if provided
  if (slug && !isValidSlug(slug)) {
    return { errorCode: ErrorCode.SLUG_INVALID };
  }

  // Check slug uniqueness
  if (slug) {
    const existing = await prisma.share.findUnique({ where: { slug } });
    if (existing) return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
  }

  // Validate expiration
  if (expiresAt) {
    if (Number.isNaN(expiresAt.getTime())) {
      return { errorCode: ErrorCode.INVALID_REQUEST };
    }
    if (expiresAt <= new Date()) {
      return { errorCode: ErrorCode.EXPIRATION_IN_PAST };
    }
  }

  // Password length
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    return {
      errorCode: ErrorCode.PASSWORD_INVALID_LENGTH,
      params: { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH },
    };
  }

  // Anonymous restrictions
  if (!context.isAuthenticated) {
    const settings = await prisma.settings.findFirst();
    if (settings && !settings.allowAnonLinkShare) {
      return { errorCode: ErrorCode.ANON_LINK_SHARE_DISABLED };
    }
    if (expiresAt) {
      const result = resolveAnonExpiry(new Date(expiresAt));
      if (result.error) {
        return { errorCode: ErrorCode.EXPIRATION_TOO_FAR, params: { days: MAX_ANON_EXPIRY_DAYS } };
      }
    } else {
      return { errorCode: ErrorCode.EXPIRATION_REQUIRED };
    }
  }

  // Hash password and encrypt URL
  if (password) {
    const hashedPassword = await hashPassword(password);
    urlOriginal = encrypt(urlOriginal, password);
    password = hashedPassword;
  }

  // Generate slug if not provided
  if (!slug) {
    slug = await generateRandomSlug(
      async (s) => !!(await prisma.share.findUnique({ where: { slug: s } }))
    );
  }

  const parsedMaxViews = maxViews && Number.isInteger(maxViews) && maxViews > 0 ? maxViews : null;

  const share = await prisma.share.create({
    data: {
      urlOriginal,
      expiresAt,
      slug,
      password: password || null,
      ownerId: context.userId,
      type: "URL",
      ipSource: context.ip,
      maxViews: parsedMaxViews,
    },
  });

  lookupIpGeolocation(context.ip);
  return { share };
}

// ---------------------------------------------------------------------------
// Paste share
// ---------------------------------------------------------------------------

export interface CreatePasteShareParams {
  paste: string;
  pastelanguage: string;
  context: ShareContext;
  expiresAt?: Date;
  slug?: string;
  password?: string;
  maxViews?: number;
}

export async function createPasteShare(params: CreatePasteShareParams) {
  const { context, expiresAt, maxViews } = params;
  const { paste, pastelanguage } = params;
  let { slug, password } = params;

  // Validate paste content
  if (!paste || paste.length < 1) {
    return { errorCode: ErrorCode.PASTE_CONTENT_EMPTY };
  }
  if (paste.length > MAX_PASTE_SIZE) {
    return {
      errorCode: ErrorCode.FILE_TOO_LARGE,
      params: { maxSizeMB: Math.round(MAX_PASTE_SIZE / (1024 * 1024)) },
    };
  }

  // Validate language
  if (!pastelanguage || !isValidPasteLanguage(pastelanguage)) {
    return { errorCode: ErrorCode.PASTE_LANGUAGE_INVALID };
  }

  // Validate slug
  if (slug && !isValidSlug(slug)) {
    return { errorCode: ErrorCode.SLUG_INVALID };
  }
  if (slug) {
    const existing = await prisma.share.findUnique({ where: { slug } });
    if (existing) return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
  }

  // Validate expiration
  if (expiresAt) {
    if (Number.isNaN(expiresAt.getTime())) {
      return { errorCode: ErrorCode.INVALID_REQUEST };
    }
    if (expiresAt <= new Date()) {
      return { errorCode: ErrorCode.EXPIRATION_IN_PAST };
    }
  }

  // Password length
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    return {
      errorCode: ErrorCode.PASSWORD_INVALID_LENGTH,
      params: { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH },
    };
  }

  // Anonymous restrictions
  if (!context.isAuthenticated) {
    const settings = await prisma.settings.findFirst();
    if (settings && !settings.allowAnonPasteShare) {
      return { errorCode: ErrorCode.ANON_PASTE_SHARE_DISABLED };
    }
    if (expiresAt) {
      const result = resolveAnonExpiry(new Date(expiresAt));
      if (result.error) {
        return { errorCode: ErrorCode.EXPIRATION_TOO_FAR, params: { days: MAX_ANON_EXPIRY_DAYS } };
      }
    } else {
      return { errorCode: ErrorCode.EXPIRATION_REQUIRED };
    }
  }

  // Hash password
  if (password) {
    password = await hashPassword(password);
  }

  // Generate slug
  if (!slug) {
    slug = await generateRandomSlug(
      async (s) => !!(await prisma.share.findUnique({ where: { slug: s } }))
    );
  }

  const parsedMaxViews = maxViews && Number.isInteger(maxViews) && maxViews > 0 ? maxViews : null;

  const share = await prisma.share.create({
    data: {
      paste,
      pastelanguage: pastelanguage as pasteType,
      expiresAt,
      slug,
      password: password || null,
      ownerId: context.userId,
      type: "PASTE",
      ipSource: context.ip,
      maxViews: parsedMaxViews,
    },
  });

  lookupIpGeolocation(context.ip);
  return { share };
}

// ---------------------------------------------------------------------------
// File share (multipart — not tus)
// ---------------------------------------------------------------------------

export interface CreateFileShareParams {
  filename: string;
  filePath: string;
  context: ShareContext;
  expiresAt?: Date;
  slug?: string;
  password?: string;
  maxViews?: number;
}

export async function createFileShare(params: CreateFileShareParams) {
  const { context, expiresAt, maxViews, filePath, filename: _filename } = params;
  let { slug, password } = params;

  // Validate slug
  if (slug && !isValidSlug(slug)) {
    return { errorCode: ErrorCode.SLUG_INVALID };
  }
  if (slug) {
    const existing = await prisma.share.findUnique({ where: { slug } });
    if (existing) return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
  }

  // Validate expiration
  if (expiresAt) {
    if (Number.isNaN(expiresAt.getTime())) {
      return { errorCode: ErrorCode.INVALID_REQUEST };
    }
    if (expiresAt <= new Date()) {
      return { errorCode: ErrorCode.EXPIRATION_IN_PAST };
    }
  }

  // Password length
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    return {
      errorCode: ErrorCode.PASSWORD_INVALID_LENGTH,
      params: { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH },
    };
  }

  // Anonymous restrictions
  if (!context.isAuthenticated) {
    const settings = await prisma.settings.findFirst();
    if (settings && !settings.allowAnonFileShare) {
      return { errorCode: ErrorCode.ANON_FILE_SHARE_DISABLED };
    }
    if (expiresAt) {
      const result = resolveAnonExpiry(new Date(expiresAt));
      if (result.error) {
        return { errorCode: ErrorCode.EXPIRATION_TOO_FAR, params: { days: MAX_ANON_EXPIRY_DAYS } };
      }
    } else {
      // Default to max anon expiry
      const result = resolveAnonExpiry(null);
      params.expiresAt = result.date;
    }
  }

  // Hash password
  if (password) {
    password = await hashPassword(password);
  }

  // Generate slug
  if (!slug) {
    slug = await generateRandomSlug(
      async (s) => !!(await prisma.share.findUnique({ where: { slug: s } }))
    );
  }

  const parsedMaxViews = maxViews && Number.isInteger(maxViews) && maxViews > 0 ? maxViews : null;

  const share = await prisma.share.create({
    data: {
      filePath,
      slug,
      type: "FILE",
      password: password || null,
      expiresAt: params.expiresAt,
      ipSource: context.ip,
      ownerId: context.userId,
      isBulk: false,
      maxViews: parsedMaxViews,
    },
  });

  lookupIpGeolocation(context.ip);
  return { share };
}

export { getContextFromRequest };
