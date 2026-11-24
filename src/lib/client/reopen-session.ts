import { signIn } from "next-auth/react";

/**
 * A password change signs out every session opened before it, the one that made the change
 * included. Signs the user straight back in with the new password. Returns false when that is
 * not possible (a two-factor code is needed, the e-mail is not verified yet...), in which case
 * the caller sends the user to the sign-in page.
 */
export async function reopenSession(email: string, password: string): Promise<boolean> {
  try {
    const result = await signIn("credentials", { email, password, redirect: false });
    return !!result && !result.error;
  } catch (error) {
    console.error("Unable to reopen the session after the password change:", error);
    return false;
  }
}
