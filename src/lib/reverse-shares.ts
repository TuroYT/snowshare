/**
 * Upload requests ("reverse shares"): a public /r/<slug> link through which anyone can send
 * files to the owner. Each submission becomes a regular bulk FILE share owned by the owner.
 */

import { prisma } from "@/lib/prisma";
import { ErrorCode } from "@/lib/api-errors";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { generateRandomSlug, hashPassword, isValidSlug } from "@/lib/security";
import type { ReverseShare } from "@/generated/prisma";

export const MAX_REVERSE_SHARE_NAME_LENGTH = 100;

export interface ReverseShareInput {
  name?: unknown;
  slug?: unknown;
  password?: unknown;
  expiresAt?: unknown;
  maxUploads?: unknown;
  maxSizeMB?: unknown;
}

type ValidationResult =
  | { errorCode: ErrorCode; data?: undefined }
  | {
      errorCode?: undefined;
      data: {
        name: string;
        slug: string | null;
        password: string | null;
        expiresAt: Date | null;
        maxUploads: number | null;
        maxSizeMB: number | null;
      };
    };

function positiveIntOrNull(value: unknown): number | null | false {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : false;
}

/** Validates the owner's input for a new upload request (password not hashed yet). */
export function validateReverseShareInput(
  input: ReverseShareInput,
  now = new Date()
): ValidationResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > MAX_REVERSE_SHARE_NAME_LENGTH) {
    return { errorCode: ErrorCode.INVALID_REQUEST };
  }

  const slug = typeof input.slug === "string" && input.slug.trim() ? input.slug.trim() : null;
  if (slug && !isValidSlug(slug)) return { errorCode: ErrorCode.SLUG_INVALID };

  const password =
    typeof input.password === "string" && input.password.trim() ? input.password.trim() : null;
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    return { errorCode: ErrorCode.PASSWORD_INVALID_LENGTH };
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt as string);
    if (Number.isNaN(expiresAt.getTime())) return { errorCode: ErrorCode.INVALID_DATE_FORMAT };
    if (expiresAt <= now) return { errorCode: ErrorCode.EXPIRATION_IN_PAST };
  }

  const maxUploads = positiveIntOrNull(input.maxUploads);
  const maxSizeMB = positiveIntOrNull(input.maxSizeMB);
  if (maxUploads === false || maxSizeMB === false) return { errorCode: ErrorCode.INVALID_REQUEST };

  return { data: { name, slug, password, expiresAt, maxUploads, maxSizeMB } };
}

/** Creates the upload request; a taken slug (custom or concurrent) is SLUG_ALREADY_TAKEN. */
export async function createReverseShare(
  ownerId: string,
  data: Extract<ValidationResult, { data: object }>["data"]
): Promise<{ errorCode?: ErrorCode; reverseShare?: ReverseShare }> {
  const taken = async (s: string) =>
    !!(await prisma.reverseShare.findUnique({ where: { slug: s }, select: { id: true } }));

  if (data.slug && (await taken(data.slug))) return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
  const slug = data.slug ?? (await generateRandomSlug(taken));

  try {
    const reverseShare = await prisma.reverseShare.create({
      data: {
        ...data,
        slug,
        ownerId,
        password: data.password ? await hashPassword(data.password) : null,
      },
    });
    return { reverseShare };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { errorCode: ErrorCode.SLUG_ALREADY_TAKEN };
    }
    throw error;
  }
}

/** What the owner sees: never the password hash. */
export function toOwnerReverseShare(rs: ReverseShare) {
  const { password, ...rest } = rs;
  return { ...rest, hasPassword: !!password };
}

/** What an uploader sees before sending files. */
export function toPublicReverseShare(rs: ReverseShare, now = new Date()) {
  return {
    name: rs.name,
    requiresPassword: !!rs.password,
    expiresAt: rs.expiresAt,
    maxSizeMB: rs.maxSizeMB,
    isOpen: isReverseShareOpen(rs, now),
  };
}

export function isReverseShareOpen(
  rs: Pick<ReverseShare, "expiresAt" | "maxUploads" | "uploadCount">,
  now = new Date()
): boolean {
  if (rs.expiresAt && rs.expiresAt <= now) return false;
  return rs.maxUploads === null || rs.uploadCount < rs.maxUploads;
}

/**
 * Atomically reserves one submission. Returns false when the request expired or is full,
 * including when the last slot was taken concurrently.
 */
export async function claimReverseShareSlot(id: string): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "ReverseShare" SET "uploadCount" = "uploadCount" + 1
    WHERE "id" = ${id}
      AND ("maxUploads" IS NULL OR "uploadCount" < "maxUploads")
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`;
  return updated === 1;
}

/** Gives back a slot reserved for a submission that failed. */
export async function releaseReverseShareSlot(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ReverseShare" SET "uploadCount" = GREATEST("uploadCount" - 1, 0) WHERE "id" = ${id}`.catch(
    (error: unknown) => console.error("Failed to release upload request slot:", error)
  );
}
