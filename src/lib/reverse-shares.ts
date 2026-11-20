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

/** Largest value of a PostgreSQL INTEGER column */
const MAX_DB_INT = 2147483647;

function positiveIntOrNull(value: unknown): number | null | false {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_DB_INT ? n : false;
}

type Parsed<T> = { errorCode: ErrorCode; value?: undefined } | { errorCode?: undefined; value: T };

const ok = <T>(value: T): Parsed<T> => ({ value });
const fail = (errorCode: ErrorCode): Parsed<never> => ({ errorCode });

function parseName(raw: unknown): Parsed<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  return !name || name.length > MAX_REVERSE_SHARE_NAME_LENGTH
    ? fail(ErrorCode.INVALID_REQUEST)
    : ok(name);
}

function parseSlug(raw: unknown): Parsed<string | null> {
  const slug = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return slug && !isValidSlug(slug) ? fail(ErrorCode.SLUG_INVALID) : ok(slug);
}

function parsePassword(raw: unknown): Parsed<string | null> {
  const password = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  if (
    password &&
    (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
  ) {
    return fail(ErrorCode.PASSWORD_INVALID_LENGTH);
  }
  return ok(password);
}

function parseExpiry(raw: unknown, now: Date): Parsed<Date | null> {
  if (!raw) return ok(null);
  const expiresAt = new Date(raw as string);
  if (Number.isNaN(expiresAt.getTime())) return fail(ErrorCode.INVALID_DATE_FORMAT);
  return expiresAt <= now ? fail(ErrorCode.EXPIRATION_IN_PAST) : ok(expiresAt);
}

function parseLimit(raw: unknown): Parsed<number | null> {
  const n = positiveIntOrNull(raw);
  return n === false ? fail(ErrorCode.INVALID_REQUEST) : ok(n);
}

/** Validates the owner's input for a new upload request (password not hashed yet). */
export function validateReverseShareInput(
  input: ReverseShareInput,
  now = new Date()
): ValidationResult {
  const name = parseName(input.name);
  if (name.errorCode) return { errorCode: name.errorCode };
  const slug = parseSlug(input.slug);
  if (slug.errorCode) return { errorCode: slug.errorCode };
  const password = parsePassword(input.password);
  if (password.errorCode) return { errorCode: password.errorCode };
  const expiresAt = parseExpiry(input.expiresAt, now);
  if (expiresAt.errorCode) return { errorCode: expiresAt.errorCode };
  const maxUploads = parseLimit(input.maxUploads);
  if (maxUploads.errorCode) return { errorCode: maxUploads.errorCode };
  const maxSizeMB = parseLimit(input.maxSizeMB);
  if (maxSizeMB.errorCode) return { errorCode: maxSizeMB.errorCode };

  return {
    data: {
      name: name.value,
      slug: slug.value,
      password: password.value,
      expiresAt: expiresAt.value,
      maxUploads: maxUploads.value,
      maxSizeMB: maxSizeMB.value,
    },
  };
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

const RELEASE_ATTEMPTS = 3;

/**
 * Gives back a slot reserved for a submission that failed. Retried a few times so a short
 * database failure does not leave the slot taken; a persistent failure is logged.
 */
export async function releaseReverseShareSlot(id: string): Promise<void> {
  for (let attempt = 1; attempt <= RELEASE_ATTEMPTS; attempt++) {
    try {
      await prisma.$executeRaw`
        UPDATE "ReverseShare" SET "uploadCount" = GREATEST("uploadCount" - 1, 0) WHERE "id" = ${id}`;
      return;
    } catch (error) {
      if (attempt === RELEASE_ATTEMPTS) {
        console.error("Failed to release upload request slot:", error);
      }
    }
  }
}
