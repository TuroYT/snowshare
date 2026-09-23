import { NextAuthOptions } from "next-auth";
import type { Prisma } from "@/generated/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { gravatarUrl } from "@/lib/gravatar";
import bcrypt from "bcryptjs";
import { Provider } from "next-auth/providers/index";
import { providerMap } from "@/lib/providers";
import { cookies } from "next/headers";
import { resolveClientIp } from "@/lib/getClientIp";
import { getRetryAfter, recordRateLimitHit, resetRateLimit } from "@/lib/rate-limit";

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
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name?: string | null;
    image?: string | null;
  }
}

// Cache for providers
let providersCache: Provider[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getDynamicProviders() {
  const now = Date.now();

  // Use cache if valid
  if (providersCache && now - cacheTimestamp < CACHE_TTL) {
    return providersCache;
  }

  const oauthProviders = await prisma.oAuthProvider.findMany({
    where: { enabled: true },
  });

  // Check if credentials login is disabled
  const settings = await prisma.settings.findFirst({
    select: { disableCredentialsLogin: true },
  });

  const providers: Provider[] = [];

  if (!settings?.disableCredentialsLogin) {
    providers.push(
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, req) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Throttle failed logins per client IP + email to slow down brute force
          const header = (name: string): string | undefined => {
            const value = req?.headers?.[name];
            return Array.isArray(value) ? value.join(",") : value;
          };
          const clientIp = resolveClientIp({
            forwardedFor: header("x-forwarded-for"),
            realIp: header("x-real-ip"),
          });
          const limitKey = `${clientIp}:${credentials.email.toLowerCase()}`;
          if (getRetryAfter("login", limitKey) > 0) {
            throw new Error("TooManyAttempts");
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
            select: { id: true, email: true, name: true, password: true, emailVerified: true },
          });

          if (!user || !user.password) {
            recordRateLimitHit("login", limitKey);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            recordRateLimitHit("login", limitKey);
            return null;
          }

          resetRateLimit("login", limitKey);

          // Check email verification if required
          const verificationSettings = await prisma.settings.findFirst({
            select: { emailVerificationRequired: true, smtpEnabled: true },
          });
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
        console.error(`Failed to initialize provider ${config.name}:`, error);
      }
    }
  }

  providersCache = providers;
  cacheTimestamp = now;

  return providers;
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const providers = await getDynamicProviders();

  const settings = await prisma.settings.findFirst({
    select: { allowIframeEmbedding: true },
  });
  const allowIframeEmbedding = settings?.allowIframeEmbedding ?? false;

  // When embedded in a cross-origin iframe, cookies must be SameSite=None; Secure
  // otherwise the browser blocks them and authentication fails.
  const cookiesConfig: NextAuthOptions["cookies"] = allowIframeEmbedding
    ? {
        sessionToken: {
          name: "next-auth.session-token",
          options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
        },
        callbackUrl: {
          name: "next-auth.callback-url",
          options: { sameSite: "none", path: "/", secure: true },
        },
        csrfToken: {
          name: "next-auth.csrf-token",
          options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
        },
      }
    : undefined;

  return {
    adapter: PrismaAdapter(prisma),
    providers,
    ...(allowIframeEmbedding && { useSecureCookies: true, cookies: cookiesConfig }),
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async signIn({ user, account }) {
        if (!account) return false;
        if (account.provider === "credentials") return true;

        if (!user.email) {
          return "/auth/signin?error=OAuthNoEmail";
        }

        const settings = await prisma.settings.findFirst();

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          // Account already linked — allow sign in
          const accountExists = existingUser.accounts.find(
            (acc: { provider: string; providerAccountId: string }) =>
              acc.provider === account.provider &&
              acc.providerAccountId === account.providerAccountId
          );
          if (accountExists) return true;

          // allowSignin applies to all new link attempts, including ssoAutoLink
          if (settings && !settings.allowSignin) return false;

          // Admin flagged this user for SSO auto-link
          if (existingUser.ssoAutoLink) {
            try {
              await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.account.create({
                  data: {
                    userId: existingUser.id,
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
                  },
                });
                await tx.user.update({
                  where: { id: existingUser.id },
                  data: { ssoAutoLink: false },
                });
              });
              console.log(`SSO auto-link: account linked for user ${existingUser.id}`);
              return true;
            } catch (error) {
              // Handle unique constraint violation — account may already be linked by a concurrent request
              if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                (error as { code: string }).code === "P2002"
              ) {
                const alreadyLinked = await prisma.account.findFirst({
                  where: {
                    userId: existingUser.id,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                  },
                });
                if (alreadyLinked) {
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
              }
              console.error("SSO auto-link error:", error);
              return false;
            }
          }

          // Explicit link token flow: the token must match the httpOnly cookie set by
          // POST /api/user/accounts/link, so only the browser that requested the link
          // can complete it.
          const cookieToken = await readLinkTokenCookie();
          if (!cookieToken) return false;

          const linkTokenIdentifier = `account-link:${existingUser.email}:${account.provider}`;
          const linkToken = await prisma.verificationToken.findFirst({
            where: {
              identifier: linkTokenIdentifier,
              token: cookieToken,
              expires: { gt: new Date() },
            },
          });

          if (!linkToken) return false;

          try {
            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              await tx.account.create({
                data: {
                  userId: existingUser.id,
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
                },
              });
              await tx.verificationToken.delete({
                where: {
                  identifier_token: {
                    identifier: linkTokenIdentifier,
                    token: linkToken.token,
                  },
                },
              });
            });
            console.log(`✅ Account linked successfully`);
            return true;
          } catch (error) {
            console.error(`❌ Error creating account link:`, error);
            return false;
          }
        }

        if (settings && !settings.allowSignin) return false;

        return true;
      },
      jwt: async ({ token, user }) => {
        if (user) {
          token.id = user.id;
          token.name = user.name;
          token.image = user.image || gravatarUrl(token.email as string);
        }
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
        }
        return session;
      },
      redirect: async ({ url, baseUrl }) => {
        // Allows relative callback URLs
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        // Allows callback URLs on the same origin
        if (new URL(url).origin === baseUrl) return url;
        return baseUrl;
      },
    },
    events: {
      async linkAccount({ user, account }) {
        console.log(`Account ${account.provider} linked to user ${user.id}`);
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  };
}

// Export default options for static usage (e.g. middleware) - Note: this won't have dynamic providers
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [], // Will be populated dynamically
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
