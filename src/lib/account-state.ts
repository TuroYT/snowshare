import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/**
 * Re-reads what the database says about the account on every session read, so changes made while
 * a session is open take effect: a session opened before an admin set the password or a reset
 * link was used is revoked, and an admin's "new password required" flag applies to live sessions.
 * Throws when the database cannot be read (fail closed).
 */
export async function applyAccountState(token: JWT): Promise<JWT> {
  if (!token.id) return token;
  if (token.revoked) return token;
  try {
    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { mustChangePassword: true, sessionsValidFrom: true },
    });
    token.revoked =
      !user ||
      (!!user.sessionsValidFrom && user.sessionsValidFrom.getTime() > (token.signedInAt ?? 0));
    token.mustChangePassword = !token.revoked && !!token.viaPassword && !!user?.mustChangePassword;
  } catch (error) {
    // Fail closed: a session whose state could not be checked must not pass as valid (it may be
    // one an admin just revoked). The error reaches the caller; the cookie is left untouched.
    console.error("Unable to refresh the account state of the session:", error);
    throw error;
  }
  return token;
}
