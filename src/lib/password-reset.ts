import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";

/** A reset link stays valid for one hour. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Tokens are bound to the user id, so a later email change cannot redirect an old link. */
function identifierFor(userId: string): string {
  return `password-reset:${userId}`;
}

/**
 * What the database stores for a reset link: HMAC-SHA256 of the token, keyed with NEXTAUTH_SECRET.
 * The token is 256 random bits (not a user-chosen password), so a fast keyed hash is right here,
 * and a leaked database cannot be used to check candidate tokens. Changing NEXTAUTH_SECRET
 * invalidates the links in flight (they last an hour).
 */
export function hashResetToken(rawToken: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to hash reset tokens");
  }
  return crypto.createHmac("sha256", secret).update(rawToken).digest("hex");
}

/**
 * Password reset by e-mail needs working SMTP, and a password sign-in form to come back to
 * (SSO-only instances have nothing to reset).
 */
export async function isPasswordResetAvailable(): Promise<boolean> {
  const settings = await getSettingsCached();
  return !!settings?.smtpEnabled && !!settings.smtpHost && !settings.disableCredentialsLogin;
}

/**
 * Creates a reset token for the user and returns the raw value. Earlier unexpired links stay
 * valid: otherwise anyone could request a reset for an address and cancel the link its owner
 * just received. Expired ones are swept here; a successful reset removes all of them.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { identifier: identifierFor(userId), expires: { lt: new Date() } },
    }),
    prisma.verificationToken.create({
      data: {
        identifier: identifierFor(userId),
        token: hashResetToken(rawToken),
        expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    }),
  ]);
  return rawToken;
}

/**
 * Whether a raw token is currently usable. Read-only on purpose: mail scanners open links
 * before the user does, so merely visiting the reset page must never burn the token.
 */
export async function isPasswordResetTokenValid(rawToken: string): Promise<boolean> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashResetToken(rawToken) },
    select: { identifier: true, expires: true },
  });
  return !!record?.identifier.startsWith("password-reset:") && record.expires > new Date();
}

/** Drops every outstanding reset token of a user (after a password change by any path). */
export async function clearPasswordResetTokens(userId: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: identifierFor(userId) } });
}
