import { NextAuthOptions } from "next-auth"
import { Provider } from "next-auth/providers"
import CredentialsProvider from "next-auth/providers/credentials"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import DiscordProvider from "next-auth/providers/discord"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { decrypt } from "@/lib/crypto-link"

declare module "next-auth" {
  interface User {
    id: string
    name?: string | null
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    name?: string | null
  }
}

// Cache for providers
let providersCache: Provider[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 1 minute

export async function getDynamicProviders() {
  const now = Date.now()
  
  // Use cache if valid
  if (providersCache && (now - cacheTimestamp) < CACHE_TTL) {
    return providersCache
  }

  const oauthProviders = await prisma.oAuthProvider.findMany({
    where: { enabled: true }
  })

  const providers: Provider[] = [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

      

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ]

  interface ProviderConfig {
    clientId: string | null
    clientSecret: string | null
  }

  const providerMap: Record<string, (config: ProviderConfig) => Provider> = {
    github: (config: ProviderConfig) => GithubProvider({
      clientId: config.clientId!,
      clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!),
    }),
    google: (config: ProviderConfig) => GoogleProvider({
      clientId: config.clientId!,
      clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!),
    }),
    discord: (config: ProviderConfig) => DiscordProvider({
      clientId: config.clientId!,
      clientSecret: decrypt(config.clientSecret!, process.env.NEXTAUTH_SECRET!),
    }),
    //LINK - Add new providers here
  }

  for (const config of oauthProviders) {
    if (config.clientId && config.clientSecret && providerMap[config.name]) {
      try {
        providers.push(providerMap[config.name](config))
      } catch (error) {
        console.error(`Failed to initialize provider ${config.name}:`, error)
      }
    }
  }

  providersCache = providers
  cacheTimestamp = now
  
  return providers
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const providers = await getDynamicProviders()
  
  return {
    adapter: PrismaAdapter(prisma),
    providers,
    session: {
      strategy: "jwt"
    },
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider === "credentials") return true;

        // For OAuth providers
        const settings = await prisma.settings.findFirst()
        
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        })

        if (existingUser) return true; // Allow login for existing users

        // If user doesn't exist, check if signup is allowed
        // Note: settings.allowSignin is used as allowSignup based on register route logic
        if (settings && !settings.allowSignin) {
          return false 
        }
        
        return true
      },
      jwt: async ({ token, user }) => {
        if (user) {
          token.id = user.id
          token.name = user.name
        }
        return token
      },
      session: async ({ session, token }) => {
        if (token && session.user) {
          session.user.id = token.id as string
          session.user.name = token.name as string | null
        }
        return session
      },
      redirect: async ({ url, baseUrl }) => {
        // Allows relative callback URLs
        if (url.startsWith("/")) return `${baseUrl}${url}`
        // Allows callback URLs on the same origin
        if (new URL(url).origin === baseUrl) return url
        return baseUrl
      }
    },
    pages: {
      signIn: "/auth/signin"
    }
  }
}

// Export default options for static usage (e.g. middleware) - Note: this won't have dynamic providers
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [], // Will be populated dynamically
  session: {
    strategy: "jwt"
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.name = user.name
      }
      return token
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}
