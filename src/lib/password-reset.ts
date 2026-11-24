import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSettingsCached } from "@/lib/settings";

/** A reset link stays valid for one hour. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Tokens are bound to the user id, so a later email change cannot redirect an old link. */
function identifierFor(userId: string): string {
  return `password-reset:${userId}`;
}

/** Only the hash is stored: a leaked database does not leak usable reset links. */
export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Password reset by e-mail needs working SMTP, and a password sign-in form to come back to
 * (SSO-only instances have nothing to reset).
 */
export async function isPasswordResetAvailable(): Promise<boolean> {
  const settings = await getSettingsCached();
  return !!settings?.smtpEnabled && !!settings.smtpHost && !settings.disableCredentialsLogin;
}

/** Creates a fresh reset token for the user, replacing any outstanding one. Returns the raw token. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: identifierFor(userId) } }),
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
