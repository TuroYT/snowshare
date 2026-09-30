/**
 * Shared share creation service.
 * Used by API routes, tus server, and frontend share endpoints.
 */

import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";
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
import type { pasteType, Share } from "@/generated/prisma";

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

/**
 * Strips server-only fields (password hash, uploader IP, storage key) from a share
 * before it is sent to a client, exposing `hasPassword` instead.
 */
export function toPublicShare<
  T extends { password?: string | null; ipSource?: string | null; filePath?: string | null },
>(share: T): Omit<T, "password" | "ipSource" | "filePath"> & { hasPassword: boolean } {
  const { password, ipSource: _ipSource, filePath: _filePath, ...rest } = share;
  return { ...rest, hasPassword: !!password };
}

// ---------------------------------------------------------------------------
// Shared validation helpers (order of checks is significant: callers run them in sequence)
// ---------------------------------------------------------------------------

type ShareError = { errorCode: ErrorCode; params?: Record<string, number> };

/** Either a validation error (errorCode, params) or the created share. */
type ShareCreationResult =
  | (ShareError & { share?: undefined })
  | { share: Share; errorCode?: undefined; params?: undefined };

type AnonShareSetting = "allowAnonLinkShare" | "allowAnonPasteShare" | "allowAnonFileShare";

/** Slug format, then uniqueness. Returns null when there is no slug or it is usable. */
async function validateRequestedSlug(slug: string | undefined): Promise<ShareError | null> {
  if (!slug) return null;
  if (!isValidSlug(slug)) {
    return { errorCode: ErrorCode.SLUG_INVALID };
  }
  const existing = await prisma.share.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
  return null;
}

function validateExpiration(expiresAt: Date | undefined): ShareError | null {
  if (!expiresAt) return null;
  if (Number.isNaN(expiresAt.getTime())) {
    return { errorCode: ErrorCode.INVALID_REQUEST };
  }
  if (expiresAt <= new Date()) {
    return { errorCode: ErrorCode.EXPIRATION_IN_PAST };
  }
  return null;
}

function validatePasswordLength(password: string | undefined): ShareError | null {
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    return {
      errorCode: ErrorCode.PASSWORD_INVALID_LENGTH,
      params: { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH },
    };
  }
  return null;
}

/** Whether the admin settings allow anonymous users to create this kind of share. */
async function isAnonShareAllowed(setting: AnonShareSetting): Promise<boolean> {
  const settings = await getSettingsCached();
  return !settings || Boolean(settings[setting]);
}

/** Anonymous shares cannot expire later than the configured maximum. */
function validateAnonExpiryRange(expiresAt: Date): ShareError | null {
  const result = resolveAnonExpiry(new Date(expiresAt));
  if (result.error) {
    return { errorCode: ErrorCode.EXPIRATION_TOO_FAR, params: { days: MAX_ANON_EXPIRY_DAYS } };
  }
  return null;
}

/** Anonymous restrictions for link and paste shares: enabled, and an expiration is required. */
async function validateAnonymousExpiringShare(
  setting: AnonShareSetting,
  disabledCode: ErrorCode,
  expiresAt: Date | undefined
): Promise<ShareError | null> {
  if (!(await isAnonShareAllowed(setting))) {
    return { errorCode: disabledCode };
  }
  if (!expiresAt) {
    return { errorCode: ErrorCode.EXPIRATION_REQUIRED };
  }
  return validateAnonExpiryRange(expiresAt);
}

async function generateUniqueSlug(): Promise<string> {
  return generateRandomSlug(
    async (s) => !!(await prisma.share.findUnique({ where: { slug: s }, select: { id: true } }))
  );
}

function parseMaxViews(maxViews: number | undefined): number | null {
  return maxViews && Number.isInteger(maxViews) && maxViews > 0 ? maxViews : null;
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

export async function createLinkShare(params: CreateLinkShareParams): Promise<ShareCreationResult> {
  const { context, expiresAt, maxViews } = params;
  let { urlOriginal, slug, password } = params;

  // Validate URL
  const urlValidation = validateUrl(urlOriginal);
  if (!urlValidation.valid) {
    return { errorCode: ErrorCode.INVALID_URL };
  }

  // Validate slug (format, then uniqueness)
  const slugError = await validateRequestedSlug(slug);
  if (slugError) return slugError;

  // Validate expiration
  const expirationError = validateExpiration(expiresAt);
  if (expirationError) return expirationError;

  // Password length
  const passwordError = validatePasswordLength(password);
  if (passwordError) return passwordError;

  // Anonymous restrictions
  if (!context.isAuthenticated) {
    const anonError = await validateAnonymousExpiringShare(
      "allowAnonLinkShare",
      ErrorCode.ANON_LINK_SHARE_DISABLED,
      expiresAt
    );
    if (anonError) return anonError;
  }

  // Hash password and encrypt URL
  if (password) {
    const hashedPassword = await hashPassword(password);
    urlOriginal = encrypt(urlOriginal, password);
    password = hashedPassword;
  }

  // Generate slug if not provided
  if (!slug) {
    slug = await generateUniqueSlug();
  }

  const parsedMaxViews = parseMaxViews(maxViews);

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

export async function createPasteShare(
  params: CreatePasteShareParams
): Promise<ShareCreationResult> {
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

  // Validate slug (format, then uniqueness)
  const slugError = await validateRequestedSlug(slug);
  if (slugError) return slugError;

  // Validate expiration
  const expirationError = validateExpiration(expiresAt);
  if (expirationError) return expirationError;

  // Password length
  const passwordError = validatePasswordLength(password);
  if (passwordError) return passwordError;

  // Anonymous restrictions
  if (!context.isAuthenticated) {
    const anonError = await validateAnonymousExpiringShare(
      "allowAnonPasteShare",
      ErrorCode.ANON_PASTE_SHARE_DISABLED,
      expiresAt
    );
    if (anonError) return anonError;
  }

  // Hash password
  if (password) {
    password = await hashPassword(password);
  }

  // Generate slug
  if (!slug) {
    slug = await generateUniqueSlug();
  }

  const parsedMaxViews = parseMaxViews(maxViews);

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
  /** File size in bytes (used for quota accounting) */
  size?: number;
  context: ShareContext;
  expiresAt?: Date;
  slug?: string;
  password?: string;
  maxViews?: number;
}

export async function createFileShare(params: CreateFileShareParams): Promise<ShareCreationResult> {
  const { context, expiresAt, maxViews, filePath, filename: _filename } = params;
  let { slug, password } = params;

  // Validate slug (format, then uniqueness)
  const slugError = await validateRequestedSlug(slug);
  if (slugError) return slugError;

  // Validate expiration
  const expirationError = validateExpiration(expiresAt);
  if (expirationError) return expirationError;

  // Password length
  const passwordError = validatePasswordLength(password);
  if (passwordError) return passwordError;

  // Anonymous restrictions
  if (!context.isAuthenticated) {
    if (!(await isAnonShareAllowed("allowAnonFileShare"))) {
      return { errorCode: ErrorCode.ANON_FILE_SHARE_DISABLED };
    }
    if (expiresAt) {
      const expiryError = validateAnonExpiryRange(expiresAt);
      if (expiryError) return expiryError;
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
    slug = await generateUniqueSlug();
  }

  const parsedMaxViews = parseMaxViews(maxViews);

  const share = await prisma.share.create({
    data: {
      filePath,
      size: params.size != null ? BigInt(params.size) : null,
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
