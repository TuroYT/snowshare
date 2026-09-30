import type { Account, Profile } from "next-auth";

/** Entra ID tenant aliases that accept users from any directory. */
const MULTI_TENANT_ALIASES = new Set(["common", "organizations", "consumers"]);

function decodeJwtClaims(token: string | undefined | null): Record<string, unknown> | null {
  if (!token) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (error) {
    console.error("OAuth: unable to decode id_token claims:", error);
    return null;
  }
}

function isTrue(value: unknown): boolean {
  return value === true || value === "true";
}

function sameEmail(claim: unknown, email: string): boolean {
  return typeof claim === "string" && claim.toLowerCase() === email.toLowerCase();
}

/**
 * Whether the identity provider vouches that the signed-in user owns `email`.
 * Only then may the OAuth account be linked to an existing user with that email
 * without an explicit link from the profile page.
 *
 * - Google / OIDC: `email_verified` claim
 * - Discord: `verified` flag
 * - Entra ID: `xms_edov` claim (domain owner verified), or a single-tenant setup
 *   where the email is managed by the configured directory's admins
 * - GitHub: never (the profile does not say whether the email is verified)
 */
export function isProviderEmailVerified(
  account: Pick<Account, "provider" | "id_token">,
  profile: Profile | undefined,
  email: string,
  azureTenantId?: string | null
): boolean {
  const claims = (profile ?? {}) as Record<string, unknown>;

  switch (account.provider) {
    case "google":
    case "oidc":
      return sameEmail(claims.email, email) && isTrue(claims.email_verified);
    case "discord":
      return sameEmail(claims.email, email) && isTrue(claims.verified);
    case "azure-ad": {
      const idToken = decodeJwtClaims(account.id_token);
      if (!idToken || !sameEmail(idToken.email, email)) return false;
      if (isTrue(idToken.xms_edov)) return true;
      const tenant = azureTenantId?.trim().toLowerCase();
      return !!tenant && !MULTI_TENANT_ALIASES.has(tenant);
    }
    default:
      return false;
  }
}
