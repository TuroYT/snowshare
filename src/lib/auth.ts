import type { Account, NextAuthOptions, Profile, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { getSettingsCached } from "@/lib/settings";
import type { Prisma } from "@/generated/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { gravatarUrl } from "@/lib/gravatar";
import bcrypt from "bcryptjs";
import { Provider } from "next-auth/providers/index";
import { providerMap } from "@/lib/providers";
import { isProviderEmailVerified } from "@/lib/oauth-email";
import { cookies } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/getClientIp";
import { getRetryAfter, recordRateLimitHit, resetRateLimit } from "@/lib/rate-limit";
import { openTotpSecret, verifyTotp } from "@/lib/totp";
import { isUnverified, refreshAccountState } from "@/lib/account-state";

/** httpOnly cookie binding an account-link request to the browser that initiated it. */
export const LINK_TOKEN_COOKIE = "__snowshare-link-token";

async function readLinkTokenCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(LINK_TOKEN_COOKIE)?.value ?? null;
  } catch (error) {
    // cookies() throws when called outside a request scope
    console.error("Account link: unable to read link token cookie:", error);
    return null;
  }
}

declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    mustChangePassword?: boolean;
    /** When a password sign-in began (ms), taken before the stored hash is read */
    authenticatedAt?: number;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** An admin asked this user to pick a new password (see /auth/change-password) */
      mustChangePassword?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name?: string | null;
    image?: string | null;
    /** An admin requires a new password: set for password sign-ins only (see proxy.ts) */
    mustChangePassword?: boolean;
    /** Signed in with a password, so a forced password change applies to this session */
    viaPassword?: boolean;
    /** When this session was opened (ms): compared with User.sessionsValidFrom */
    signedInAt?: number;
    /** Opened before an admin or a reset changed the password, or the user is gone */
    revoked?: boolean;
  }
}

type ExistingUserWithAccounts = Prisma.UserGetPayload<{ include: { accounts: true } }>;

function buildAccountData(userId: string, account: Account) {
  return {
    userId,
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refresh_token: account.refresh_token,
    access_token: account.access_token,
    expires_at: account.expires_at,
    token_type: account.token_type,
    scope: account.scope,
    id_token: account.id_token,
    session_state: account.session_state as string | null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Handles a unique constraint violation while auto-linking: the account may already have been
 * linked by a concurrent request. Returns true when that is the case.
 */
async function recoverFromConcurrentAutoLink(
  existingUser: ExistingUserWithAccounts,
  account: Account
): Promise<boolean> {
  const alreadyLinked = await prisma.account.findFirst({
    where: {
      userId: existingUser.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    },
  });
  if (!alreadyLinked) return false;

  // Reset flag if it wasn't reset yet by the concurrent request
  const stillFlagged = await prisma.user.findUnique({
    where: { id: existingUser.id },
    select: { ssoAutoLink: true },
  });
  if (stillFlagged?.ssoAutoLink) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { ssoAutoLink: false },
    });
  }
  return true;
}

/**
 * Admin flagged this user for SSO auto-link, or the provider vouches for the email:
 * link the account without an explicit token.
 */
async function autoLinkSsoAccount(
  existingUser: ExistingUserWithAccounts,
  account: Account
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.account.create({ data: buildAccountData(existingUser.id, account) });
      await tx.user.update({
        where: { id: existingUser.id },
        data: { ssoAutoLink: false },
      });
    });
    console.log(
      `SSO auto-link: ${account.provider} linked to user ${existingUser.id} (${
        existingUser.ssoAutoLink ? "admin flag" : "verified email"
      })`
    );
    return true;
  } catch (error) {
    // Handle unique constraint violation — account may already be linked by a concurrent request
    if (
      isUniqueConstraintError(error) &&
      (await recoverFromConcurrentAutoLink(existingUser, account))
    ) {
      return true;
    }
    console.error("SSO auto-link error:", error);
    return false;
  }
}

/**
 * Explicit link token flow: the token must match the httpOnly cookie set by
 * POST /api/user/accounts/link, so only the browser that requested the link
 * can complete it.
 */
async function linkAccountWithToken(
  existingUser: ExistingUserWithAccounts,
  account: Account
): Promise<boolean | string> {
  const notLinked = (reason: string) => {
    console.warn(
      `SSO sign-in refused: ${account.provider} not linked to user ${existingUser.id} (${reason})`
    );
    return "/auth/signin?error=OAuthAccountNotLinked";
  };

  const cookieToken = await readLinkTokenCookie();
  if (!cookieToken) return notLinked("no link request");

  const linkTokenIdentifier = `account-link:${existingUser.email}:${account.provider}`;
  const linkToken = await prisma.verificationToken.findFirst({
    where: {
      identifier: linkTokenIdentifier,
      token: cookieToken,
      expires: { gt: new Date() },
    },
  });

  if (!linkToken) return notLinked("invalid or expired link request");

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.account.create({ data: buildAccountData(existingUser.id, account) });
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: linkTokenIdentifier,
            token: linkToken.token,
          },
        },
      });
    });
    return true;
  } catch (error) {
    console.error("Error creating account link:", error);
    return false;
  }
}

/**
 * Whether an existing account may receive an unrequested link from a provider that vouches for
 * its email. Anyone can register (or switch to) an address they do not own while email
 * verification is off, so linking blindly would hand the real owner's SSO identity to that
 * account ("pre-account takeover"). Hence:
 * - no password: a password-holder could keep signing in alongside the real owner;
 * - emailVerified set: by the verification link, or by a sign-in through a provider that vouches
 *   for the email (see markEmailVerifiedByProvider). An unverified in-app email change clears it
 *   (src/app/api/user/profile/route.ts).
 * Other accounts link from the profile page (link token) or through the admin's ssoAutoLink flag.
 */
function canAutoLinkByVerifiedEmail(user: ExistingUserWithAccounts): boolean {
  return !user.password && !!user.emailVerified;
}

async function getAzureTenantId(provider: string): Promise<string | null | undefined> {
  if (provider !== "azure-ad") return null;
  const config = await prisma.oAuthProvider.findUnique({
    where: { name: "azure-ad" },
    select: { tenantId: true },
  });
  return config?.tenantId;
}

/**
 * Records that the user proved ownership of their email by signing in through a provider that
 * vouches for it (makes the account eligible for verified-email auto-links).
 */
async function markEmailVerifiedByProvider(
  user: { id: string; email?: string | null; emailVerified?: Date | null },
  account: Account | null,
  profile: Profile | undefined
): Promise<void> {
  if (!account || account.provider === "credentials" || !user.email || user.emailVerified) return;
  try {
    const tenantId = await getAzureTenantId(account.provider);
    if (!isProviderEmailVerified(account, profile, user.email, tenantId)) return;
    await prisma.user.updateMany({
      where: { id: user.id, email: user.email, emailVerified: null },
      data: { emailVerified: new Date() },
    });
  } catch (error) {
    console.error("SSO sign-in: failed to record the provider-verified email:", error);
  }
}

async function handleExistingUserSignIn(
  existingUser: ExistingUserWithAccounts,
  account: Account,
  settings: Awaited<ReturnType<typeof getSettingsCached>>,
  profile: Profile | undefined,
  email: string
): Promise<boolean | string> {
  // Account already linked — allow sign in
  const accountExists = existingUser.accounts.some(
    (acc: { provider: string; providerAccountId: string }) =>
      acc.provider === account.provider && acc.providerAccountId === account.providerAccountId
  );
  if (accountExists) return true;

  // Linking creates no user, so the sign-up setting (allowSignin) does not block
  // the links someone explicitly asked for: the admin's ssoAutoLink flag and the
  // link token requested from the profile page.
  if (existingUser.ssoAutoLink) {
    return autoLinkSsoAccount(existingUser, account);
  }

  // Unrequested link on a provider-verified email: only while sign-up is open, and only to an
  // account whose email ownership was proven (see canAutoLinkByVerifiedEmail)
  if ((!settings || settings.allowSignin) && canAutoLinkByVerifiedEmail(existingUser)) {
    const azureTenantId = await getAzureTenantId(account.provider);
    if (isProviderEmailVerified(account, profile, email, azureTenantId)) {
      return autoLinkSsoAccount(existingUser, account);
    }
  }

  return linkAccountWithToken(existingUser, account);
}

let providersCache: Provider[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getDynamicProviders() {
  const now = Date.now();

  if (providersCache && now - cacheTimestamp < CACHE_TTL) {
    return providersCache;
  }

  const oauthProviders = await prisma.oAuthProvider.findMany({
    where: { enabled: true },
  });

  const settings = await getSettingsCached();

  const providers: Provider[] = [];

  if (!settings?.disableCredentialsLogin) {
    providers.push(
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
          totp: { label: "Authentication code", type: "text" },
        },
        async authorize(credentials, req) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }
          // Taken before the stored hash is read: a password change that lands while this
          // sign-in is in flight then revokes the session it produces (see refreshAccountState)
          const authenticatedAt = Date.now();

          // Throttle failed logins per client IP + email to slow down brute force. The IP
          // resolved by server.js from the socket comes first, like in getClientIp()
          const clientIp = getClientIpFromHeaders((name) => {
            const value = req?.headers?.[name];
            return Array.isArray(value) ? value.join(",") : value;
          });
          const limitKey = `${clientIp}:${credentials.email.toLowerCase()}`;
          if (getRetryAfter("login", limitKey) > 0) {
            throw new Error("TooManyAttempts");
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              emailVerified: true,
              totpEnabled: true,
              totpSecret: true,
              totpLastCounter: true,
              mustChangePassword: true,
            },
          });

          if (!user?.password) {
            recordRateLimitHit("login", limitKey);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            recordRateLimitHit("login", limitKey);
            return null;
          }

          if (user.totpEnabled && user.totpSecret) {
            if (!credentials.totp) throw new Error("TotpRequired");
            const counter = verifyTotp(openTotpSecret(user.totpSecret), credentials.totp, {
              lastCounter: user.totpLastCounter,
            });
            if (counter === null) {
              recordRateLimitHit("login", limitKey);
              throw new Error("TotpInvalid");
            }
            // Claim the time step atomically: two concurrent sign-ins can't replay one code
            const claimed = await prisma.user.updateMany({
              where: {
                id: user.id,
                OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }],
              },
              data: { totpLastCounter: counter },
            });
            if (claimed.count === 0) {
              recordRateLimitHit("login", limitKey);
              throw new Error("TotpInvalid");
            }
          }

          resetRateLimit("login", limitKey);

          const verificationSettings = await getSettingsCached();
          if (
            verificationSettings?.emailVerificationRequired &&
            verificationSettings.smtpEnabled &&
            !user.emailVerified
          ) {
            throw new Error("EmailNotVerified");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            mustChangePassword: user.mustChangePassword,
            authenticatedAt,
          };
        },
      })
    );
  }

  for (const config of oauthProviders) {
    if (config.clientId && config.clientSecret && providerMap[config.name]) {
      try {
        providers.push(providerMap[config.name](config));
      } catch (error) {
        console.error("Failed to initialize provider %s:", config.name, error);
      }
    }
  }

  providersCache = providers;
  cacheTimestamp = now;

  return providers;
}

/**
 * Whether next-auth's default cookie names carry the __Secure-/__Host- prefixes. Same rule as
 * getToken() (proxy.ts, server.js) and the static authOptions: NEXTAUTH_URL on https.
 */
function usesSecureCookiePrefix(): boolean {
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;
}

/**
 * Cookies for a cross-origin iframe: they must be SameSite=None; Secure, otherwise the browser
 * blocks them. The names stay next-auth's defaults: every other session reader (static
 * authOptions, getToken) looks the session cookie up under those names.
 */
export function crossSiteCookies(): NonNullable<NextAuthOptions["cookies"]> {
  const secure = usesSecureCookiePrefix();
  const prefix = secure ? "__Secure-" : "";
  return {
    sessionToken: {
      name: `${prefix}next-auth.session-token`,
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
    },
    callbackUrl: {
      name: `${prefix}next-auth.callback-url`,
      options: { sameSite: "none", path: "/", secure: true },
    },
    csrfToken: {
      name: `${secure ? "__Host-" : ""}next-auth.csrf-token`,
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
    },
  };
}

/**
 * A revoked session is an empty one, which next-auth reads as "not signed in" everywhere:
 * getServerSession() returns null (routes answer 401) and the client sees no session. A session
 * without a user would make the client believe it is signed in and crash on the missing user.
 */
function withoutUserIfRevoked(session: Session, token: JWT): Session {
  // Revoked, or the database could not be asked: deny, without touching the cookie
  if (token.revoked || isUnverified(token)) return {} as Session;
  return session;
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const providers = await getDynamicProviders();

  const settings = await getSettingsCached();
  const allowIframeEmbedding = settings?.allowIframeEmbedding ?? false;

  const cookiesConfig = allowIframeEmbedding ? crossSiteCookies() : undefined;

  return {
    adapter: PrismaAdapter(prisma),
    providers,
    ...(allowIframeEmbedding && { useSecureCookies: true, cookies: cookiesConfig }),
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (!account) return false;
        if (account.provider === "credentials") return true;

        if (!user.email) {
          return "/auth/signin?error=OAuthNoEmail";
        }

        const settings = await getSettingsCached();

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          return handleExistingUserSignIn(existingUser, account, settings, profile, user.email);
        }

        if (settings && !settings.allowSignin) {
          console.warn(`SSO sign-in refused: sign-up disabled for new ${account.provider} user`);
          return "/auth/signin?error=OAuthSigninDisabled";
        }

        return true;
      },
      jwt: async ({ token, user, account }) => {
        if (user) {
          token.id = user.id;
          token.name = user.name;
          token.image = user.image || gravatarUrl(token.email as string);
          token.signedInAt = user.authenticatedAt ?? Date.now();
          token.revoked = false;
          // Only a password sign-in is asked for a new password: an SSO user may not have one
          token.viaPassword = account?.provider === "credentials";
        }
        await refreshAccountState(token);
        if (!token.image && token.email) {
          token.image = gravatarUrl(token.email as string);
        }
        return token;
      },
      session: async ({ session, token }) => {
        if (token && session.user) {
          session.user.id = token.id as string;
          session.user.name = token.name as string | null;
          session.user.image = token.image as string | null;
          session.user.mustChangePassword = token.mustChangePassword === true;
        }
        return withoutUserIfRevoked(session, token);
      },
      redirect: async ({ url, baseUrl }) => {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
    events: {
      async signIn({ user, account, profile }) {
        await markEmailVerifiedByProvider(
          user as { id: string; email?: string | null; emailVerified?: Date | null },
          account,
          profile
        );
      },
    },
    pages: {
      signIn: "/auth/signin",
      error: "/auth/signin",
    },
  };
}

// Static options for middleware: no dynamic providers
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return refreshAccountState(token);
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string | null;
        session.user.mustChangePassword = token.mustChangePassword === true;
      }
      return withoutUserIfRevoked(session, token);
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
